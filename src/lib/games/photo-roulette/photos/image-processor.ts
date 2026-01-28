/**
 * Image processing utility for photo roulette
 *
 * Handles fetching photos with OAuth tokens, resizing, and compression.
 * This is needed because Google Photos URLs are tied to the OAuth token
 * of the user who picked them - we need to transfer actual image data.
 */

import type { PickedPhoto } from './types.js';
import { getValidToken } from './oauth.js';

/** Maximum dimension for resized images (bounding box) */
export const MAX_IMAGE_SIZE = 1600;

/** JPEG compression quality (0-1) */
export const JPEG_QUALITY = 0.8;

/** A processed image ready for transfer */
export interface ProcessedImage {
	id: string;
	imageData: string; // base64 encoded JPEG (without data URL prefix)
	width: number;
	height: number;
	originalFilename?: string;
}

/**
 * Fetch an image with OAuth authorization header
 */
async function fetchWithAuth(url: string, accessToken: string): Promise<Blob> {
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
	}

	return response.blob();
}

/**
 * Load a blob as an HTMLImageElement
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(blob);

		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

/**
 * Calculate new dimensions to fit within bounding box while maintaining aspect ratio
 */
function calculateDimensions(
	width: number,
	height: number,
	maxSize: number
): { width: number; height: number } {
	if (width <= maxSize && height <= maxSize) {
		return { width, height };
	}

	const ratio = Math.min(maxSize / width, maxSize / height);
	return {
		width: Math.round(width * ratio),
		height: Math.round(height * ratio),
	};
}

/**
 * Resize an image to fit within a bounding box and compress as JPEG
 */
function resizeAndCompress(
	img: HTMLImageElement,
	maxSize: number,
	quality: number
): Promise<{ blob: Blob; width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const { width, height } = calculateDimensions(img.naturalWidth, img.naturalHeight, maxSize);

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			reject(new Error('Failed to get canvas context'));
			return;
		}

		// Use high-quality image smoothing
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';

		ctx.drawImage(img, 0, 0, width, height);

		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve({ blob, width, height });
				} else {
					reject(new Error('Failed to create blob from canvas'));
				}
			},
			'image/jpeg',
			quality
		);
	});
}

/**
 * Convert a blob to a base64 string (without the data URL prefix)
 */
function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => {
			const result = reader.result as string;
			// Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
			const base64 = result.split(',')[1];
			resolve(base64);
		};

		reader.onerror = () => {
			reject(new Error('Failed to read blob as base64'));
		};

		reader.readAsDataURL(blob);
	});
}

/**
 * Fetch and process a single image
 */
export async function fetchAndProcessImage(
	baseUrl: string,
	accessToken: string,
	maxSize: number = MAX_IMAGE_SIZE,
	quality: number = JPEG_QUALITY
): Promise<{ imageData: string; width: number; height: number }> {
	// Append size parameters to base URL for initial fetch
	// This reduces bandwidth by getting a reasonably sized image from Google
	const sizedUrl = `${baseUrl}=w${maxSize}-h${maxSize}`;

	// Fetch with authorization
	const blob = await fetchWithAuth(sizedUrl, accessToken);

	// Load into image element
	const img = await loadImage(blob);

	// Resize and compress (may already be right size, but ensures consistent output)
	const { blob: processedBlob, width, height } = await resizeAndCompress(img, maxSize, quality);

	// Convert to base64
	const imageData = await blobToBase64(processedBlob);

	return { imageData, width, height };
}

/**
 * Process all picked photos
 * Fetches, resizes, and converts to base64 for transfer over WebRTC
 */
export async function processPickedPhotos(
	photos: PickedPhoto[],
	accessToken?: string,
	onProgress?: (current: number, total: number, message: string) => void
): Promise<ProcessedImage[]> {
	// Get token if not provided
	const token = accessToken || getValidToken()?.accessToken;
	if (!token) {
		throw new Error('No valid access token available');
	}

	const processed: ProcessedImage[] = [];
	const total = photos.length;

	// Process sequentially to avoid memory spikes
	for (let i = 0; i < photos.length; i++) {
		const photo = photos[i];
		onProgress?.(i + 1, total, `Processing photo ${i + 1}/${total}...`);

		try {
			const { imageData, width, height } = await fetchAndProcessImage(photo.baseUrl, token);

			processed.push({
				id: photo.id,
				imageData,
				width,
				height,
				originalFilename: photo.filename,
			});
		} catch (error) {
			// Log error but continue with other photos
			console.error(`Failed to process photo ${photo.id}:`, error);
			// Don't add to processed array - skip failed photos
		}
	}

	if (processed.length === 0) {
		throw new Error('Failed to process any photos');
	}

	onProgress?.(total, total, `Processed ${processed.length} photos`);
	return processed;
}

/**
 * Create a data URL from base64 image data
 */
export function createDataUrl(imageData: string): string {
	return `data:image/jpeg;base64,${imageData}`;
}

/**
 * Estimate the size of base64 encoded data in bytes
 */
export function estimateBase64Size(base64: string): number {
	// Base64 encoding increases size by ~33%
	// So decode length is approximately 3/4 of encoded length
	return Math.ceil((base64.length * 3) / 4);
}
