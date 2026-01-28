/**
 * Tests for OAuth 2.0 utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	createOAuthConfig,
	parseCallbackParams,
	isTokenValid,
} from './oauth.js';
import { PICKER_OAUTH_SCOPE, TOKEN_REFRESH_BUFFER_MS } from './constants.js';
import type { OAuthToken } from './types.js';

describe('createOAuthConfig', () => {
	it('should create config with client ID and redirect URI', () => {
		const config = createOAuthConfig(
			'test-client-id.apps.googleusercontent.com',
			'http://localhost:5173/auth/callback'
		);

		expect(config).toEqual({
			clientId: 'test-client-id.apps.googleusercontent.com',
			redirectUri: 'http://localhost:5173/auth/callback',
			scope: PICKER_OAUTH_SCOPE,
		});
	});

	it('should use the picker OAuth scope', () => {
		const config = createOAuthConfig('client', 'http://example.com/callback');
		expect(config.scope).toBe('https://www.googleapis.com/auth/photospicker.mediaitems.readonly');
	});
});

describe('parseCallbackParams', () => {
	it('should parse successful callback with code and state', () => {
		const url = 'http://localhost:5173/auth/callback?code=auth-code-123&state=random-state-456';
		const result = parseCallbackParams(url);

		expect(result).toEqual({
			code: 'auth-code-123',
			state: 'random-state-456',
		});
	});

	it('should parse error callback', () => {
		const url =
			'http://localhost:5173/auth/callback?error=access_denied&error_description=User%20denied%20access';
		const result = parseCallbackParams(url);

		expect(result).toEqual({
			error: 'access_denied',
			errorDescription: 'User denied access',
		});
	});

	it('should handle error without description', () => {
		const url = 'http://localhost:5173/auth/callback?error=server_error';
		const result = parseCallbackParams(url);

		expect(result).toEqual({
			error: 'server_error',
			errorDescription: undefined,
		});
	});

	it('should return error for missing code', () => {
		const url = 'http://localhost:5173/auth/callback?state=some-state';
		const result = parseCallbackParams(url);

		expect('error' in result).toBe(true);
		if ('error' in result) {
			expect(result.error).toBe('missing_params');
		}
	});

	it('should return error for missing state', () => {
		const url = 'http://localhost:5173/auth/callback?code=some-code';
		const result = parseCallbackParams(url);

		expect('error' in result).toBe(true);
		if ('error' in result) {
			expect(result.error).toBe('missing_params');
		}
	});

	it('should handle URL-encoded parameters', () => {
		const url =
			'http://localhost:5173/auth/callback?code=4%2F0test&state=abc%3D%3D123';
		const result = parseCallbackParams(url);

		expect(result).toEqual({
			code: '4/0test',
			state: 'abc==123',
		});
	});
});

describe('isTokenValid', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
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
