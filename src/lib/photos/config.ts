/**
 * Google Photos configuration
 *
 * This module provides configuration for the Google Photos Picker integration.
 * The client ID should be provided via environment variable.
 */

import { createOAuthConfig } from './oauth.js';
import type { OAuthConfig } from './types.js';

/**
 * Get the Google OAuth client ID from environment
 *
 * In SvelteKit, use: import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
 * Then pass it to this function.
 */
export function getPhotosConfig(clientId: string, baseUrl: string): OAuthConfig {
	if (!clientId) {
		throw new Error(
			'Google OAuth client ID is not configured. ' +
				'Set PUBLIC_GOOGLE_CLIENT_ID in your .env file.'
		);
	}

	const redirectUri = `${baseUrl}/auth/google/callback`;

	return createOAuthConfig(clientId, redirectUri);
}

/**
 * Check if Google Photos integration is configured
 */
export function isPhotosConfigured(clientId: string | undefined): boolean {
	return Boolean(clientId && clientId.length > 0);
}
