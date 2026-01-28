/**
 * Types for Google Photos Picker API integration
 *
 * Based on: https://developers.google.com/photos/picker/reference/rest
 */

/** OAuth 2.0 token response */
export interface OAuthToken {
	accessToken: string;
	expiresAt: number; // Unix timestamp in ms
	tokenType: string;
}

/** Polling configuration from the Picker API */
export interface PollingConfig {
	/** Recommended time between poll requests (e.g., "2s") */
	pollInterval: string;
	/** Maximum duration to wait before timeout (e.g., "1800s") */
	timeoutIn: string;
}

/** Configuration for photo picking */
export interface PickingConfig {
	/** Maximum number of items user can pick (default: 2000) */
	maxItemCount?: number;
}

/** A picking session from the Picker API */
export interface PickingSession {
	/** Google-generated session identifier */
	id: string;
	/** URL to redirect the user to Google Photos */
	pickerUri: string;
	/** Polling configuration */
	pollingConfig: PollingConfig;
	/** Session expiration time in RFC 3339 format */
	expireTime: string;
	/** Whether the user has finished picking media items */
	mediaItemsSet: boolean;
}

/** Media type enum */
export type MediaType = 'PHOTO' | 'VIDEO';

/** Metadata about a media file */
export interface MediaFileMetadata {
	width?: string;
	height?: string;
	cameraMake?: string;
	cameraModel?: string;
}

/** Media file information */
export interface MediaFile {
	/** Base URL for fetching the media file */
	baseUrl: string;
	/** MIME type (e.g., "image/jpeg") */
	mimeType: string;
	/** Original filename */
	filename?: string;
	/** Additional metadata */
	mediaFileMetadata?: MediaFileMetadata;
}

/** A media item picked by the user */
export interface PickedMediaItem {
	/** Persistent identifier for the media item */
	id: string;
	/** Creation time in RFC 3339 format */
	createTime: string;
	/** Type: PHOTO or VIDEO */
	type: MediaType;
	/** File information including baseUrl */
	mediaFile: MediaFile;
}

/** Response from mediaItems.list endpoint */
export interface MediaItemsListResponse {
	/** Array of picked media items */
	mediaItems?: PickedMediaItem[];
	/** Token for fetching next page */
	nextPageToken?: string;
}

/** Picker session state for tracking progress */
export type PickerSessionState =
	| 'idle'
	| 'creating'
	| 'waiting-for-user'
	| 'polling'
	| 'fetching-items'
	| 'complete'
	| 'error'
	| 'timeout';

/** Error types from the Picker API */
export type PickerErrorType =
	| 'no-google-photos-account'
	| 'session-limit-exceeded'
	| 'session-expired'
	| 'user-cancelled'
	| 'network-error'
	| 'auth-error'
	| 'timeout'
	| 'unknown';

/** Error from the Picker API */
export interface PickerError {
	type: PickerErrorType;
	message: string;
	originalError?: unknown;
}

/** Result of a completed picking session */
export interface PickerResult {
	/** Successfully picked photos */
	photos: PickedPhoto[];
	/** Session ID (for cleanup) */
	sessionId: string;
}

/** A photo ready for use in the game (simplified from PickedMediaItem) */
export interface PickedPhoto {
	/** Unique identifier */
	id: string;
	/** Base URL for fetching (valid for 60 minutes) */
	baseUrl: string;
	/** MIME type */
	mimeType: string;
	/** Original filename */
	filename?: string;
	/** Width in pixels */
	width?: number;
	/** Height in pixels */
	height?: number;
}

/** OAuth configuration */
export interface OAuthConfig {
	clientId: string;
	redirectUri: string;
	scope: string;
}

/** Callback functions for picker events */
export interface PickerCallbacks {
	onStateChange?: (state: PickerSessionState) => void;
	onError?: (error: PickerError) => void;
	onProgress?: (message: string) => void;
}
