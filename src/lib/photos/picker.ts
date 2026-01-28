/**
 * Google Photos Picker API service
 *
 * Handles session creation, polling, and media item retrieval
 */

import type {
	OAuthToken,
	PickingSession,
	PickedMediaItem,
	PickedPhoto,
	PickerResult,
	PickerError,
	PickerSessionState,
	PickerCallbacks,
	MediaItemsListResponse,
} from './types.js';
import {
	PICKER_API_BASE_URL,
	DEFAULT_MAX_PICK_COUNT,
	MEDIA_ITEMS_PAGE_SIZE,
	DEFAULT_POLL_INTERVAL_MS,
	MAX_POLLING_TIMEOUT_MS,
	PICKER_AUTOCLOSE_SUFFIX,
} from './constants.js';
import { getValidToken } from './oauth.js';

/**
 * Parse duration string (e.g., "2s", "1800s") to milliseconds
 */
function parseDurationToMs(duration: string): number {
	const match = duration.match(/^(\d+(?:\.\d+)?)s$/);
	if (!match) return DEFAULT_POLL_INTERVAL_MS;
	return Math.round(parseFloat(match[1]) * 1000);
}

/** Request options for fetch */
type FetchOptions = {
	method?: string;
	headers?: Record<string, string>;
	body?: string;
};

/**
 * Make an authenticated request to the Picker API
 */
async function pickerApiRequest<T>(
	endpoint: string,
	options: FetchOptions = {},
	token?: OAuthToken
): Promise<T> {
	const authToken = token || getValidToken();
	if (!authToken) {
		throw createPickerError('auth-error', 'No valid OAuth token available');
	}

	const url = `${PICKER_API_BASE_URL}${endpoint}`;
	const response = await fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${authToken.accessToken}`,
			'Content-Type': 'application/json',
			...options.headers,
		},
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw handleApiError(response.status, errorData);
	}

	return response.json();
}

/**
 * Handle API errors and convert to PickerError
 */
function handleApiError(status: number, errorData: Record<string, unknown>): PickerError {
	const errorMessage = (errorData.error as { message?: string })?.message || 'Unknown error';
	const errorStatus = (errorData.error as { status?: string })?.status;

	if (status === 401 || status === 403) {
		return createPickerError('auth-error', 'Authentication failed. Please sign in again.');
	}

	if (errorStatus === 'FAILED_PRECONDITION') {
		if (errorMessage.includes('Google Photos')) {
			return createPickerError(
				'no-google-photos-account',
				'You need an active Google Photos account to use this feature.'
			);
		}
		return createPickerError('unknown', errorMessage);
	}

	if (errorStatus === 'RESOURCE_EXHAUSTED') {
		return createPickerError(
			'session-limit-exceeded',
			'Too many photo picking sessions. Please try again later.'
		);
	}

	return createPickerError('unknown', errorMessage, errorData);
}

/**
 * Create a PickerError object
 */
function createPickerError(
	type: PickerError['type'],
	message: string,
	originalError?: unknown
): PickerError {
	return { type, message, originalError };
}

/**
 * Create a new picking session
 */
export async function createSession(
	maxItemCount: number = DEFAULT_MAX_PICK_COUNT,
	token?: OAuthToken
): Promise<PickingSession> {
	const requestId = crypto.randomUUID();

	const session = await pickerApiRequest<PickingSession>(
		`/sessions?requestId=${requestId}`,
		{
			method: 'POST',
			body: JSON.stringify({
				pickingConfig: {
					maxItemCount,
				},
			}),
		},
		token
	);

	return session;
}

/**
 * Get session status
 */
export async function getSession(sessionId: string, token?: OAuthToken): Promise<PickingSession> {
	return pickerApiRequest<PickingSession>(`/sessions/${sessionId}`, { method: 'GET' }, token);
}

/**
 * Delete a session (cleanup)
 */
export async function deleteSession(sessionId: string, token?: OAuthToken): Promise<void> {
	await pickerApiRequest(`/sessions/${sessionId}`, { method: 'DELETE' }, token);
}

/**
 * List media items from a completed session
 */
export async function listMediaItems(
	sessionId: string,
	pageToken?: string,
	token?: OAuthToken
): Promise<MediaItemsListResponse> {
	const params = new URLSearchParams({
		sessionId,
		pageSize: MEDIA_ITEMS_PAGE_SIZE.toString(),
	});

	if (pageToken) {
		params.set('pageToken', pageToken);
	}

	return pickerApiRequest<MediaItemsListResponse>(
		`/mediaItems?${params.toString()}`,
		{ method: 'GET' },
		token
	);
}

/**
 * Fetch all media items from a session (handles pagination)
 */
export async function fetchAllMediaItems(
	sessionId: string,
	token?: OAuthToken
): Promise<PickedMediaItem[]> {
	const allItems: PickedMediaItem[] = [];
	let pageToken: string | undefined;

	do {
		const response = await listMediaItems(sessionId, pageToken, token);
		if (response.mediaItems) {
			allItems.push(...response.mediaItems);
		}
		pageToken = response.nextPageToken;
	} while (pageToken);

	return allItems;
}

/**
 * Convert PickedMediaItem to simplified PickedPhoto
 */
export function toPickedPhoto(item: PickedMediaItem): PickedPhoto {
	const metadata = item.mediaFile.mediaFileMetadata;

	return {
		id: item.id,
		baseUrl: item.mediaFile.baseUrl,
		mimeType: item.mediaFile.mimeType,
		filename: item.mediaFile.filename,
		width: metadata?.width ? parseInt(metadata.width, 10) : undefined,
		height: metadata?.height ? parseInt(metadata.height, 10) : undefined,
	};
}

/**
 * Open the Google Photos picker in a new tab/window
 */
export function openPickerWindow(pickerUri: string): Window | null {
	// Append autoclose suffix for better UX
	const uri = pickerUri.endsWith(PICKER_AUTOCLOSE_SUFFIX)
		? pickerUri
		: pickerUri + PICKER_AUTOCLOSE_SUFFIX;

	return window.open(uri, '_blank', 'noopener');
}

/**
 * Poll a session until the user finishes picking or timeout
 */
export async function pollSessionUntilComplete(
	sessionId: string,
	pollingConfig: PickingSession['pollingConfig'],
	callbacks?: PickerCallbacks,
	token?: OAuthToken
): Promise<PickingSession> {
	const pollIntervalMs = parseDurationToMs(pollingConfig.pollInterval);
	const timeoutMs = Math.min(parseDurationToMs(pollingConfig.timeoutIn), MAX_POLLING_TIMEOUT_MS);

	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		// Wait for the poll interval
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

		const session = await getSession(sessionId, token);

		if (session.mediaItemsSet) {
			return session;
		}

		callbacks?.onProgress?.(`Waiting for photo selection...`);
	}

	throw createPickerError('timeout', 'Photo selection timed out. Please try again.');
}

/**
 * Complete photo picking flow
 *
 * 1. Creates a session
 * 2. Opens the picker in a new window
 * 3. Polls for completion
 * 4. Fetches selected photos
 * 5. Cleans up the session
 */
export async function pickPhotos(
	maxItemCount: number = DEFAULT_MAX_PICK_COUNT,
	callbacks?: PickerCallbacks,
	token?: OAuthToken
): Promise<PickerResult> {
	let sessionId: string | undefined;

	const updateState = (state: PickerSessionState) => {
		callbacks?.onStateChange?.(state);
	};

	try {
		// Step 1: Create session
		updateState('creating');
		callbacks?.onProgress?.('Creating photo picker session...');

		const session = await createSession(maxItemCount, token);
		sessionId = session.id;

		// Step 2: Open picker window
		updateState('waiting-for-user');
		callbacks?.onProgress?.('Opening Google Photos...');

		const pickerWindow = openPickerWindow(session.pickerUri);
		if (!pickerWindow) {
			throw createPickerError(
				'unknown',
				'Could not open Google Photos. Please check if popups are blocked.'
			);
		}

		// Step 3: Poll for completion
		updateState('polling');
		const completedSession = await pollSessionUntilComplete(
			session.id,
			session.pollingConfig,
			callbacks,
			token
		);

		// Check if user actually selected anything
		if (!completedSession.mediaItemsSet) {
			throw createPickerError('user-cancelled', 'No photos were selected.');
		}

		// Step 4: Fetch media items
		updateState('fetching-items');
		callbacks?.onProgress?.('Fetching selected photos...');

		const mediaItems = await fetchAllMediaItems(session.id, token);

		// Filter to only photos (no videos)
		const photoItems = mediaItems.filter((item) => item.type === 'PHOTO');
		const photos = photoItems.map(toPickedPhoto);

		// Step 5: Cleanup session
		try {
			await deleteSession(session.id, token);
		} catch {
			// Ignore cleanup errors
		}

		updateState('complete');
		callbacks?.onProgress?.(`Selected ${photos.length} photos`);

		return {
			photos,
			sessionId: session.id,
		};
	} catch (error) {
		updateState('error');

		// Clean up session on error
		if (sessionId) {
			try {
				await deleteSession(sessionId, token);
			} catch {
				// Ignore cleanup errors
			}
		}

		if (isPickerError(error)) {
			callbacks?.onError?.(error);
			throw error;
		}

		const pickerError = createPickerError(
			'network-error',
			error instanceof Error ? error.message : 'An unexpected error occurred',
			error
		);
		callbacks?.onError?.(pickerError);
		throw pickerError;
	}
}

/**
 * Type guard for PickerError
 */
function isPickerError(error: unknown): error is PickerError {
	return (
		typeof error === 'object' &&
		error !== null &&
		'type' in error &&
		'message' in error &&
		typeof (error as PickerError).type === 'string' &&
		typeof (error as PickerError).message === 'string'
	);
}

/**
 * Build a URL to fetch a photo at a specific size
 *
 * Google Photos base URLs require width/height parameters
 * See: https://developers.google.com/photos/picker/guides/media-items
 */
export function buildPhotoUrl(baseUrl: string, maxWidth: number, maxHeight: number): string {
	return `${baseUrl}=w${maxWidth}-h${maxHeight}`;
}

/**
 * Build a URL to download the full photo
 */
export function buildDownloadUrl(baseUrl: string): string {
	return `${baseUrl}=d`;
}
