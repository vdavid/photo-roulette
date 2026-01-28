/**
 * Constants for Google Photos Picker API integration
 */

/** Google Photos Picker API base URL */
export const PICKER_API_BASE_URL = 'https://photospicker.googleapis.com/v1';

/** Required OAuth scope for the Picker API */
export const PICKER_OAUTH_SCOPE =
	'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

/** Default max items a user can pick */
export const DEFAULT_MAX_PICK_COUNT = 100;

/** Minimum photos required to be ready for the game */
export const MIN_PHOTOS_REQUIRED = 5;

/** Maximum photos to request per page when listing media items */
export const MEDIA_ITEMS_PAGE_SIZE = 100;

/** How long base URLs are valid (in milliseconds) */
export const BASE_URL_VALIDITY_MS = 60 * 60 * 1000; // 60 minutes

/** Default poll interval if not specified by API (in milliseconds) */
export const DEFAULT_POLL_INTERVAL_MS = 2000;

/** Maximum time to wait for user to pick photos (in milliseconds) */
export const MAX_POLLING_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** Buffer time before token expiry to trigger refresh (in milliseconds) */
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/** Storage key for OAuth token */
export const OAUTH_TOKEN_STORAGE_KEY = 'photo-roulette-oauth-token';

/** Suffix to append to pickerUri for auto-close behavior */
export const PICKER_AUTOCLOSE_SUFFIX = '/autoclose';
