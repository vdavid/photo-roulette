import { describe, it, expect } from 'vitest';

describe('sample test', () => {
	it('should verify test setup works', () => {
		expect(1 + 1).toBe(2);
	});

	it('should handle strings', () => {
		const greeting = 'Hello, Bunny!';
		expect(greeting).toContain('Bunny');
	});
});
