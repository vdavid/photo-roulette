/**
 * Tests for OAuth 2.0 utilities (Google Identity Services)
 *
 * Note: Storage tests are skipped because they require browser APIs
 * (localStorage/sessionStorage) which are not available in Node.js.
 * These functions are tested indirectly through integration tests.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { isTokenValid } from './oauth.js';
import { TOKEN_REFRESH_BUFFER_MS } from './constants.js';
import type { OAuthToken } from './types.js';

describe('isTokenValid', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should return false for null token', () => {
		expect(isTokenValid(null)).toBe(false);
	});

	it('should return true for token expiring far in the future', () => {
		const token: OAuthToken = {
			accessToken: 'valid-token',
			expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
			tokenType: 'Bearer',
		};

		expect(isTokenValid(token)).toBe(true);
	});

	it('should return false for expired token', () => {
		const token: OAuthToken = {
			accessToken: 'expired-token',
			expiresAt: Date.now() - 1000, // 1 second ago
			tokenType: 'Bearer',
		};

		expect(isTokenValid(token)).toBe(false);
	});

	it('should return false for token expiring within buffer time', () => {
		const token: OAuthToken = {
			accessToken: 'almost-expired-token',
			expiresAt: Date.now() + TOKEN_REFRESH_BUFFER_MS - 1000, // Just under buffer
			tokenType: 'Bearer',
		};

		expect(isTokenValid(token)).toBe(false);
	});

	it('should return true for token expiring just after buffer time', () => {
		const token: OAuthToken = {
			accessToken: 'still-valid-token',
			expiresAt: Date.now() + TOKEN_REFRESH_BUFFER_MS + 1000, // Just over buffer
			tokenType: 'Bearer',
		};

		expect(isTokenValid(token)).toBe(true);
	});
});

// Note: saveToken, loadToken, clearToken, and hasValidToken tests are skipped
// because they depend on localStorage/sessionStorage which aren't available
// in the Node.js test environment. These are tested through browser-based
// integration tests.
