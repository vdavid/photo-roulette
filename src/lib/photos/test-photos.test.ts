/**
 * Tests for test photo generation
 */

import { describe, it, expect } from 'vitest';
import { isTestPlayer } from './test-photos.js';

describe('isTestPlayer', () => {
	it('returns true for valid test player names', () => {
		expect(isTestPlayer('AAA')).toBe(true);
		expect(isTestPlayer('BBB')).toBe(true);
		expect(isTestPlayer('ZZZ')).toBe(true);
	});

	it('returns false for lowercase letters', () => {
		expect(isTestPlayer('aaa')).toBe(false);
		expect(isTestPlayer('bbb')).toBe(false);
	});

	it('returns false for mixed case', () => {
		expect(isTestPlayer('Aaa')).toBe(false);
		expect(isTestPlayer('aAa')).toBe(false);
	});

	it('returns false for different letters', () => {
		expect(isTestPlayer('ABC')).toBe(false);
		expect(isTestPlayer('AAB')).toBe(false);
		expect(isTestPlayer('ABA')).toBe(false);
	});

	it('returns false for wrong length', () => {
		expect(isTestPlayer('AA')).toBe(false);
		expect(isTestPlayer('AAAA')).toBe(false);
		expect(isTestPlayer('A')).toBe(false);
	});

	it('returns false for regular names', () => {
		expect(isTestPlayer('David')).toBe(false);
		expect(isTestPlayer('Anna')).toBe(false);
		expect(isTestPlayer('Bob')).toBe(false);
	});

	it('returns false for empty string', () => {
		expect(isTestPlayer('')).toBe(false);
	});

	it('returns false for strings with numbers', () => {
		expect(isTestPlayer('A1A')).toBe(false);
		expect(isTestPlayer('111')).toBe(false);
	});

	it('returns false for strings with special characters', () => {
		expect(isTestPlayer('A@A')).toBe(false);
		expect(isTestPlayer('A A')).toBe(false);
	});
});

// Note: generateTestPhotos and generateTestImage use canvas which requires DOM
// These would need to be tested in an E2E environment or with jsdom
