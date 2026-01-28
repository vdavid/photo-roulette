/**
 * Google Photos configuration
 *
 * This module provides configuration helpers for the Google Photos Picker integration.
 */

/**
 * Check if Google Photos integration is configured
 */
export function isPhotosConfigured(clientId: string | undefined): boolean {
	return Boolean(clientId && clientId.length > 0);
}
