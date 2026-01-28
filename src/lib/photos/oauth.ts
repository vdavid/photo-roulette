/**
 * OAuth 2.0 service for Google Photos authentication
 *
 * Uses Google Identity Services (GIS) for browser-based OAuth.
 * This approach doesn't require a backend or client secret.
 */

import type { OAuthToken } from './types.js';
import {
	OAUTH_TOKEN_STORAGE_KEY,
	TOKEN_REFRESH_BUFFER_MS,
	PICKER_OAUTH_SCOPE,
} from './constants.js';

/** Google Identity Services types (loaded from external script) */
declare const google: {
	accounts: {
		oauth2: {
			initTokenClient: (config: TokenClientConfig) => TokenClient;
			revoke: (token: string, callback?: () => void) => void;
		};
	};
};

interface TokenClientConfig {
	client_id: string;
	scope: string;
	callback: (response: TokenResponse) => void;
	error_callback?: (error: TokenError) => void;
	prompt?: string;
}

interface TokenClient {
	requestAccessToken: (options?: { prompt?: string }) => void;
}

interface TokenResponse {
	access_token: string;
	expires_in: number;
	token_type: string;
	scope: string;
	error?: string;
	error_description?: string;
}

interface TokenError {
	type: string;
	message?: string;
}

/** Track if GIS library is loaded */
let gisLoaded = false;

/**
 * Wait for Google Identity Services library to load
 */
function waitForGis(timeoutMs: number = 10000): Promise<void> {
	if (gisLoaded) return Promise.resolve();

	return new Promise((resolve, reject) => {
		const startTime = Date.now();

		const checkGis = () => {
			if (typeof google !== 'undefined' && google.accounts?.oauth2) {
				gisLoaded = true;
				resolve();
			} else if (Date.now() - startTime > timeoutMs) {
				reject(new Error('Google Identity Services failed to load. Please refresh the page.'));
			} else {
				setTimeout(checkGis, 100);
			}
		};

		checkGis();
	});
}

/**
 * Request an access token using Google Identity Services
 *
 * This opens a popup for the user to sign in and authorize access.
 */
export async function requestAccessToken(clientId: string): Promise<OAuthToken> {
	await waitForGis();

	return new Promise((resolve, reject) => {
		const tokenClient = google.accounts.oauth2.initTokenClient({
			client_id: clientId,
			scope: PICKER_OAUTH_SCOPE,
			callback: (response: TokenResponse) => {
				if (response.error) {
					reject(new Error(response.error_description || response.error));
					return;
				}

				const token: OAuthToken = {
					accessToken: response.access_token,
					expiresAt: Date.now() + response.expires_in * 1000,
					tokenType: response.token_type,
				};

				// Store token
				saveToken(token);
				resolve(token);
			},
			error_callback: (error: TokenError) => {
				if (error.type === 'popup_closed') {
					reject(new Error('Sign-in was cancelled. Please try again.'));
				} else if (error.type === 'popup_failed_to_open') {
					reject(new Error('Could not open sign-in popup. Please allow popups for this site.'));
				} else {
					reject(new Error(error.message || `Authentication error: ${error.type}`));
				}
			},
		});

		// Request the token - this opens the Google sign-in popup
		tokenClient.requestAccessToken();
	});
}

/**
 * Revoke the current access token
 */
export async function revokeToken(): Promise<void> {
	const token = loadToken();
	if (!token) return;

	await waitForGis();

	return new Promise((resolve) => {
		google.accounts.oauth2.revoke(token.accessToken, () => {
			clearToken();
			resolve();
		});
	});
}

/**
 * Save token to storage
 */
export function saveToken(token: OAuthToken): void {
	try {
		localStorage.setItem(OAUTH_TOKEN_STORAGE_KEY, JSON.stringify(token));
	} catch {
		// Fall back to session storage if localStorage fails
		sessionStorage.setItem(OAUTH_TOKEN_STORAGE_KEY, JSON.stringify(token));
	}
}

/**
 * Load token from storage
 */
export function loadToken(): OAuthToken | null {
	try {
		const stored =
			localStorage.getItem(OAUTH_TOKEN_STORAGE_KEY) ||
			sessionStorage.getItem(OAUTH_TOKEN_STORAGE_KEY);

		if (!stored) return null;

		return JSON.parse(stored) as OAuthToken;
	} catch {
		return null;
	}
}

/**
 * Clear stored token
 */
export function clearToken(): void {
	localStorage.removeItem(OAUTH_TOKEN_STORAGE_KEY);
	sessionStorage.removeItem(OAUTH_TOKEN_STORAGE_KEY);
}

/**
 * Check if token is valid and not expired
 */
export function isTokenValid(token: OAuthToken | null): boolean {
	if (!token) return false;
	// Consider token invalid if it expires within the buffer time
	return token.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS;
}

/**
 * Get the current valid token, or null if not available/expired
 */
export function getValidToken(): OAuthToken | null {
	const token = loadToken();
	return isTokenValid(token) ? token : null;
}

/**
 * Check if we have a valid token
 */
export function hasValidToken(): boolean {
	return getValidToken() !== null;
}

/**
 * Get a valid token, requesting a new one if needed
 *
 * This is the main entry point for getting an auth token.
 * If the user is not signed in, this will open the Google sign-in popup.
 */
export async function ensureValidToken(clientId: string): Promise<OAuthToken> {
	const existingToken = getValidToken();
	if (existingToken) {
		return existingToken;
	}

	// Need to request a new token
	return requestAccessToken(clientId);
}
