/**
 * OAuth 2.0 service for Google Photos authentication
 *
 * Uses Authorization Code Flow with PKCE (recommended for SPAs)
 */

import type { OAuthConfig, OAuthToken } from './types.js';
import {
	OAUTH_AUTH_URL,
	OAUTH_TOKEN_URL,
	OAUTH_TOKEN_STORAGE_KEY,
	OAUTH_STATE_STORAGE_KEY,
	TOKEN_REFRESH_BUFFER_MS,
	PICKER_OAUTH_SCOPE,
} from './constants.js';

/** PKCE code verifier storage key */
const CODE_VERIFIER_STORAGE_KEY = 'photo-roulette-code-verifier';

/**
 * Generate a cryptographically random string for PKCE
 */
function generateRandomString(length: number): string {
	const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
	const randomValues = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(randomValues, (v) => charset[v % charset.length]).join('');
}

/**
 * Generate SHA-256 hash and base64url encode it for PKCE challenge
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const digest = await crypto.subtle.digest('SHA-256', data);

	// Base64url encode (no padding, URL-safe characters)
	const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState(): string {
	return generateRandomString(32);
}

/**
 * Build the OAuth authorization URL
 */
export async function buildAuthorizationUrl(config: OAuthConfig): Promise<string> {
	// Generate PKCE code verifier and challenge
	const codeVerifier = generateRandomString(64);
	const codeChallenge = await generateCodeChallenge(codeVerifier);

	// Generate state for CSRF protection
	const state = generateState();

	// Store verifier and state for later use
	sessionStorage.setItem(CODE_VERIFIER_STORAGE_KEY, codeVerifier);
	sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state);

	const params = new URLSearchParams({
		client_id: config.clientId,
		redirect_uri: config.redirectUri,
		response_type: 'code',
		scope: config.scope,
		state: state,
		code_challenge: codeChallenge,
		code_challenge_method: 'S256',
		access_type: 'offline', // Request refresh token
		prompt: 'consent', // Always show consent to get refresh token
	});

	return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForToken(code: string, config: OAuthConfig): Promise<OAuthToken> {
	const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_STORAGE_KEY);
	if (!codeVerifier) {
		throw new Error('Code verifier not found. Please restart the authorization flow.');
	}

	const params = new URLSearchParams({
		client_id: config.clientId,
		code: code,
		code_verifier: codeVerifier,
		grant_type: 'authorization_code',
		redirect_uri: config.redirectUri,
	});

	const response = await fetch(OAUTH_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: params.toString(),
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			`Token exchange failed: ${errorData.error_description || errorData.error || response.statusText}`
		);
	}

	const data = await response.json();

	// Clean up verifier
	sessionStorage.removeItem(CODE_VERIFIER_STORAGE_KEY);

	const token: OAuthToken = {
		accessToken: data.access_token,
		expiresAt: Date.now() + data.expires_in * 1000,
		tokenType: data.token_type,
	};

	// Store token
	saveToken(token);

	return token;
}

/**
 * Validate the OAuth callback state parameter
 */
export function validateState(receivedState: string): boolean {
	const savedState = sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY);
	sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY); // Clean up
	return savedState === receivedState;
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
 * Create OAuth config with default scope
 */
export function createOAuthConfig(clientId: string, redirectUri: string): OAuthConfig {
	return {
		clientId,
		redirectUri,
		scope: PICKER_OAUTH_SCOPE,
	};
}

/**
 * Parse OAuth callback URL parameters
 */
export function parseCallbackParams(
	url: string
): { code: string; state: string } | { error: string; errorDescription?: string } {
	const urlObj = new URL(url);
	const params = urlObj.searchParams;

	const error = params.get('error');
	if (error) {
		return {
			error,
			errorDescription: params.get('error_description') || undefined,
		};
	}

	const code = params.get('code');
	const state = params.get('state');

	if (!code || !state) {
		return { error: 'missing_params', errorDescription: 'Missing code or state parameter' };
	}

	return { code, state };
}
