/**
 * Tests for Google Photos Picker API utilities
 */

import { describe, it, expect } from 'vitest';
import { toPickedPhoto, buildPhotoUrl, buildDownloadUrl } from './picker.js';
import type { PickedMediaItem } from './types.js';

describe('toPickedPhoto', () => {
	it('should convert a PickedMediaItem to PickedPhoto', () => {
		const item: PickedMediaItem = {
			id: 'photo-123',
			createTime: '2024-01-15T10:30:00Z',
			type: 'PHOTO',
			mediaFile: {
				baseUrl: 'https://lh3.googleusercontent.com/abc123',
				mimeType: 'image/jpeg',
				filename: 'vacation.jpg',
				mediaFileMetadata: {
					width: '1920',
					height: '1080',
					cameraMake: 'Apple',
					cameraModel: 'iPhone 14',
				},
			},
		};

		const photo = toPickedPhoto(item);

		expect(photo).toEqual({
			id: 'photo-123',
			baseUrl: 'https://lh3.googleusercontent.com/abc123',
			mimeType: 'image/jpeg',
			filename: 'vacation.jpg',
			width: 1920,
			height: 1080,
		});
	});

	it('should handle missing optional fields', () => {
		const item: PickedMediaItem = {
			id: 'photo-456',
			createTime: '2024-02-20T15:00:00Z',
			type: 'PHOTO',
			mediaFile: {
				baseUrl: 'https://lh3.googleusercontent.com/xyz789',
				mimeType: 'image/png',
			},
		};

		const photo = toPickedPhoto(item);

		expect(photo).toEqual({
			id: 'photo-456',
			baseUrl: 'https://lh3.googleusercontent.com/xyz789',
			mimeType: 'image/png',
			filename: undefined,
			width: undefined,
			height: undefined,
		});
	});

	it('should handle missing mediaFileMetadata', () => {
		const item: PickedMediaItem = {
			id: 'photo-789',
			createTime: '2024-03-10T08:00:00Z',
			type: 'PHOTO',
			mediaFile: {
				baseUrl: 'https://lh3.googleusercontent.com/def456',
				mimeType: 'image/webp',
				filename: 'screenshot.webp',
			},
		};

		const photo = toPickedPhoto(item);

		expect(photo.width).toBeUndefined();
		expect(photo.height).toBeUndefined();
		expect(photo.filename).toBe('screenshot.webp');
	});
});

describe('buildPhotoUrl', () => {
	const baseUrl = 'https://lh3.googleusercontent.com/abc123';

	it('should append width and height parameters', () => {
		const url = buildPhotoUrl(baseUrl, 800, 600);
		expect(url).toBe('https://lh3.googleusercontent.com/abc123=w800-h600');
	});

	it('should handle large dimensions', () => {
		const url = buildPhotoUrl(baseUrl, 4096, 2160);
		expect(url).toBe('https://lh3.googleusercontent.com/abc123=w4096-h2160');
	});

	it('should handle small dimensions', () => {
		const url = buildPhotoUrl(baseUrl, 100, 100);
		expect(url).toBe('https://lh3.googleusercontent.com/abc123=w100-h100');
	});
});

describe('buildDownloadUrl', () => {
	it('should append download parameter', () => {
		const baseUrl = 'https://lh3.googleusercontent.com/abc123';
		const url = buildDownloadUrl(baseUrl);
		expect(url).toBe('https://lh3.googleusercontent.com/abc123=d');
	});

	it('should work with different base URLs', () => {
		const baseUrl = 'https://lh3.googleusercontent.com/p/xyz789';
		const url = buildDownloadUrl(baseUrl);
		expect(url).toBe('https://lh3.googleusercontent.com/p/xyz789=d');
	});
});
