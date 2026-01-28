/**
 * Utilities for fetching Google Photos with authentication
 *
 * Photos Picker API base URLs require the OAuth access token to be passed
 * as an Authorization header - they're not publicly accessible.
 */

import { getValidToken } from './oauth.js';

/** Cache of blob URLs to prevent re-fetching */
const blobUrlCache = new Map<string, string>();

/** Set of blob URLs that have been revoked */
const revokedUrls = new Set<string>();

/**
 * Fetch an image using the OAuth access token and return a Blob URL
 *
 * @param imageUrl - The Google Photos base URL (with size params)
 * @param accessToken - Optional access token (uses stored token if not provided)
 * @returns A blob URL that can be used in <img src="...">
 */
export async function fetchAuthenticatedImage(
	imageUrl: string,
	accessToken?: string
): Promise<string> {
	// Check cache first
	const cached = blobUrlCache.get(imageUrl);
	if (cached && !revokedUrls.has(cached)) {
		return cached;
	}

	// Get token
	const token = accessToken || getValidToken()?.accessToken;
	if (!token) {
		throw new Error('No valid access token available');
	}

	// Fetch with authorization header
	const response = await fetch(imageUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
	}

	// Convert to blob and create URL
	const blob = await response.blob();
	const blobUrl = URL.createObjectURL(blob);

	// Cache it
	blobUrlCache.set(imageUrl, blobUrl);

	return blobUrl;
}

/**
 * Revoke a blob URL to free memory
 */
export function revokeBlobUrl(blobUrl: string): void {
	if (blobUrl.startsWith('blob:')) {
		URL.revokeObjectURL(blobUrl);
		revokedUrls.add(blobUrl);
	}
}

/**
 * Clear all cached blob URLs (call when game ends or user leaves)
 */
export function clearBlobUrlCache(): void {
	for (const blobUrl of blobUrlCache.values()) {
		URL.revokeObjectURL(blobUrl);
		revokedUrls.add(blobUrl);
	}
	blobUrlCache.clear();
}

/**
 * Get the number of cached blob URLs (for debugging)
 */
export function getCacheSize(): number {
	return blobUrlCache.size;
}
