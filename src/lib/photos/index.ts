/**
 * Google Photos Picker API integration
 *
 * This module provides everything needed to:
 * 1. Authenticate users with Google OAuth 2.0 (via Google Identity Services)
 * 2. Open the Google Photos Picker for photo selection
 * 3. Retrieve selected photos for use in the game
 *
 * Usage:
 * ```ts
 * import { ensureValidToken, pickPhotos } from '$lib/photos';
 * import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
 *
 * // Step 1: Ensure we have a valid token (opens popup if needed)
 * const token = await ensureValidToken(PUBLIC_GOOGLE_CLIENT_ID);
 *
 * // Step 2: Pick photos
 * const result = await pickPhotos(30, {
 *   onStateChange: (state) => console.log('State:', state),
 *   onProgress: (msg) => console.log(msg),
 * }, token);
 *
 * // result.photos contains the selected photos
 * ```
 */

// Types
export type {
	OAuthToken,
	PollingConfig,
	PickingConfig,
	PickingSession,
	MediaType,
	MediaFile,
	MediaFileMetadata,
	PickedMediaItem,
	MediaItemsListResponse,
	PickerSessionState,
	PickerErrorType,
	PickerError,
	PickerResult,
	PickedPhoto,
	PickerCallbacks,
} from './types.js';

// Constants
export {
	PICKER_API_BASE_URL,
	PICKER_OAUTH_SCOPE,
	DEFAULT_MAX_PICK_COUNT,
	MIN_PHOTOS_REQUIRED,
	MEDIA_ITEMS_PAGE_SIZE,
	BASE_URL_VALIDITY_MS,
	DEFAULT_POLL_INTERVAL_MS,
	MAX_POLLING_TIMEOUT_MS,
	TOKEN_REFRESH_BUFFER_MS,
	PICKER_AUTOCLOSE_SUFFIX,
} from './constants.js';

// OAuth functions
export {
	requestAccessToken,
	revokeToken,
	ensureValidToken,
	saveToken,
	loadToken,
	clearToken,
	isTokenValid,
	getValidToken,
	hasValidToken,
} from './oauth.js';

// Picker functions
export {
	createSession,
	getSession,
	deleteSession,
	listMediaItems,
	fetchAllMediaItems,
	toPickedPhoto,
	openBlankPickerWindow,
	navigatePickerWindow,
	openPickerWindow,
	pollSessionUntilComplete,
	pickPhotos,
	buildPhotoUrl,
	buildDownloadUrl,
} from './picker.js';

// Configuration
export { isPhotosConfigured } from './config.js';
