/**
 * Google Photos Picker API integration
 *
 * This module provides everything needed to:
 * 1. Authenticate users with Google OAuth 2.0
 * 2. Open the Google Photos Picker for photo selection
 * 3. Retrieve selected photos for use in the game
 *
 * Usage:
 * ```ts
 * import { createOAuthConfig, buildAuthorizationUrl, pickPhotos } from '$lib/photos';
 *
 * // Step 1: Configure OAuth
 * const config = createOAuthConfig(CLIENT_ID, REDIRECT_URI);
 *
 * // Step 2: Start auth flow (redirect user)
 * const authUrl = await buildAuthorizationUrl(config);
 * window.location.href = authUrl;
 *
 * // Step 3: Handle callback (in your callback route)
 * const params = parseCallbackParams(window.location.href);
 * if ('code' in params && validateState(params.state)) {
 *   await exchangeCodeForToken(params.code, config);
 * }
 *
 * // Step 4: Pick photos (after auth)
 * const result = await pickPhotos(30, {
 *   onStateChange: (state) => console.log('State:', state),
 *   onProgress: (msg) => console.log(msg),
 * });
 *
 * // result.photos contains the selected photos
 * ```
 */

// Types
export type {
	OAuthToken,
	OAuthConfig,
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
	OAUTH_AUTH_URL,
	OAUTH_TOKEN_URL,
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
	buildAuthorizationUrl,
	exchangeCodeForToken,
	validateState,
	saveToken,
	loadToken,
	clearToken,
	isTokenValid,
	getValidToken,
	hasValidToken,
	createOAuthConfig,
	parseCallbackParams,
} from './oauth.js';

// Picker functions
export {
	createSession,
	getSession,
	deleteSession,
	listMediaItems,
	fetchAllMediaItems,
	toPickedPhoto,
	openPickerWindow,
	pollSessionUntilComplete,
	pickPhotos,
	buildPhotoUrl,
	buildDownloadUrl,
} from './picker.js';

// Configuration
export { getPhotosConfig, isPhotosConfigured } from './config.js';
