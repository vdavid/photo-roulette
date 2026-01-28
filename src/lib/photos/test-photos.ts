/**
 * Test photo generation for local development and E2E testing
 *
 * When a player name is 3 identical uppercase letters (e.g., "AAA", "BBB"),
 * the app automatically generates test photos instead of using Google Photos.
 * This enables testing without any external dependencies.
 */

import type { ProcessedImage } from './image-processor.js';

/** Pattern for test player names: 3 identical uppercase letters */
const TEST_PLAYER_PATTERN = /^([A-Z])\1{2}$/;

/** Color palette for test players (by first letter) */
const PLAYER_COLORS: Record<string, { bg: string; text: string }> = {
	A: { bg: '#E57373', text: '#FFFFFF' }, // Red
	B: { bg: '#64B5F6', text: '#FFFFFF' }, // Blue
	C: { bg: '#81C784', text: '#FFFFFF' }, // Green
	D: { bg: '#FFD54F', text: '#333333' }, // Yellow
	E: { bg: '#BA68C8', text: '#FFFFFF' }, // Purple
	F: { bg: '#FF8A65', text: '#FFFFFF' }, // Orange
	G: { bg: '#4DB6AC', text: '#FFFFFF' }, // Teal
	H: { bg: '#A1887F', text: '#FFFFFF' }, // Brown
	I: { bg: '#F06292', text: '#FFFFFF' }, // Pink
	J: { bg: '#7986CB', text: '#FFFFFF' }, // Indigo
	K: { bg: '#4FC3F7', text: '#333333' }, // Light Blue
	L: { bg: '#AED581', text: '#333333' }, // Light Green
	M: { bg: '#FFB74D', text: '#333333' }, // Amber
	N: { bg: '#9575CD', text: '#FFFFFF' }, // Deep Purple
	O: { bg: '#4DD0E1', text: '#333333' }, // Cyan
	P: { bg: '#F48FB1', text: '#333333' }, // Light Pink
	Q: { bg: '#90A4AE', text: '#FFFFFF' }, // Blue Grey
	R: { bg: '#E53935', text: '#FFFFFF' }, // Dark Red
	S: { bg: '#43A047', text: '#FFFFFF' }, // Dark Green
	T: { bg: '#1E88E5', text: '#FFFFFF' }, // Dark Blue
	U: { bg: '#8E24AA', text: '#FFFFFF' }, // Dark Purple
	V: { bg: '#00897B', text: '#FFFFFF' }, // Dark Teal
	W: { bg: '#6D4C41', text: '#FFFFFF' }, // Dark Brown
	X: { bg: '#546E7A', text: '#FFFFFF' }, // Dark Grey
	Y: { bg: '#FDD835', text: '#333333' }, // Bright Yellow
	Z: { bg: '#3949AB', text: '#FFFFFF' }, // Dark Indigo
};

/** Default colors if letter not found */
const DEFAULT_COLORS = { bg: '#9E9E9E', text: '#FFFFFF' };

/**
 * Check if a player name is a test player name
 * Test names are 3 identical uppercase letters: AAA, BBB, CCC, etc.
 */
export function isTestPlayer(name: string): boolean {
	return TEST_PLAYER_PATTERN.test(name);
}

/**
 * Get colors for a test player based on their name
 */
function getPlayerColors(name: string): { bg: string; text: string } {
	const letter = name.charAt(0).toUpperCase();
	return PLAYER_COLORS[letter] || DEFAULT_COLORS;
}

/**
 * Generate a single test image as base64
 */
function generateTestImage(
	playerName: string,
	photoNumber: number,
	width: number = 800,
	height: number = 600
): string {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Failed to get canvas context');
	}

	const colors = getPlayerColors(playerName);

	// Fill background
	ctx.fillStyle = colors.bg;
	ctx.fillRect(0, 0, width, height);

	// Add subtle pattern for visual interest (deterministic based on photo number)
	ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
	for (let i = 0; i < 20; i++) {
		// Use deterministic positions based on photo number and index
		const seed = photoNumber * 20 + i;
		const x = ((seed * 7919) % width); // Prime-based pseudo-random
		const y = ((seed * 6271) % height);
		const size = 20 + ((seed * 3571) % 60);
		ctx.beginPath();
		ctx.arc(x, y, size, 0, Math.PI * 2);
		ctx.fill();
	}

	// Draw main label
	const label = `${playerName}/${photoNumber}`;
	ctx.fillStyle = colors.text;
	ctx.font = 'bold 120px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	// Add shadow for better readability
	ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
	ctx.shadowBlur = 10;
	ctx.shadowOffsetX = 4;
	ctx.shadowOffsetY = 4;

	ctx.fillText(label, width / 2, height / 2);

	// Reset shadow and add smaller "TEST" watermark
	ctx.shadowColor = 'transparent';
	ctx.font = '24px system-ui, sans-serif';
	ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
	ctx.fillText('TEST PHOTO', width / 2, height - 40);

	// Convert to base64 JPEG (without the data URL prefix)
	const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
	return dataUrl.split(',')[1];
}

/**
 * Generate test photos for a test player
 * Returns ProcessedImage array ready to be used like real photos
 */
export function generateTestPhotos(playerName: string, count: number = 15): ProcessedImage[] {
	if (!isTestPlayer(playerName)) {
		throw new Error(
			`Invalid test player name: ${playerName}. Must be 3 identical uppercase letters.`
		);
	}

	const photos: ProcessedImage[] = [];

	for (let i = 1; i <= count; i++) {
		const imageData = generateTestImage(playerName, i);
		photos.push({
			id: `test-${playerName}-${i}`,
			imageData,
			width: 800,
			height: 600,
			originalFilename: `${playerName}_${i}.jpg`,
		});
	}

	return photos;
}

/**
 * Check if we're in a browser environment (needed for canvas)
 */
export function canGenerateTestPhotos(): boolean {
	return typeof document !== 'undefined' && typeof document.createElement === 'function';
}
