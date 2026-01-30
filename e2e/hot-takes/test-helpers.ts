import type { Page, BrowserContext } from '@playwright/test';
import { injectPeerJsMockToContext } from '../peerjs-mock';

/**
 * Test timing configuration for Hot Takes E2E tests.
 */
export const TEST_TIMINGS = {
	/** Reveal display time in ms (default: 5000ms, test: 100ms) */
	REVEAL_MS: 100,
	/** Voting time in seconds (default: 10-30s, test: 2s) */
	VOTING_SECONDS: 2,
	/** Guessing time in seconds (default: 15-45s, test: 2s) */
	GUESSING_SECONDS: 2,
};

export interface TestConfigOptions {
	/** Use real PeerJS instead of mock (needed for multi-browser tests) */
	useRealPeerJS?: boolean;
	/** Worker index for unique peer ID prefixes */
	workerIndex?: number;
}

/**
 * Inject all test overrides into a browser context.
 * By default, injects PeerJS mock for fast single-browser tests.
 * Use useMock: false for multi-browser tests that need real networking.
 */
export async function injectTestConfigToContext(
	context: BrowserContext,
	workerIndexOrOptions?: number | TestConfigOptions
): Promise<void> {
	// Parse options (support legacy number-only signature)
	const options: TestConfigOptions =
		typeof workerIndexOrOptions === 'number'
			? { workerIndex: workerIndexOrOptions }
			: workerIndexOrOptions || {};

	// By default, use mock for single-browser tests (faster)
	// Multi-browser tests should pass useRealPeerJS: true
	const useMock = !options.useRealPeerJS;

	if (useMock) {
		// Inject PeerJS mock for fast in-memory networking
		await injectPeerJsMockToContext(context);
	}

	// Inject timing overrides and peer ID prefix
	await context.addInitScript(
		({ timings, workerIndex, useMock }) => {
			// Hot Takes timing overrides
			(window as unknown as Record<string, number>).__TEST_HOT_TAKES_REVEAL_MS__ = timings.REVEAL_MS;
			(window as unknown as Record<string, number>).__TEST_HOT_TAKES_VOTING_SECONDS__ =
				timings.VOTING_SECONDS;
			(window as unknown as Record<string, number>).__TEST_HOT_TAKES_GUESSING_SECONDS__ =
				timings.GUESSING_SECONDS;
			// Photo Roulette timing override
			(window as unknown as Record<string, number>).__TEST_RESULT_DISPLAY_MS__ = 100;
			// Peer ID prefix for worker isolation (needed for real PeerJS to avoid collisions)
			if (workerIndex !== undefined && !useMock) {
				(window as unknown as Record<string, string>).__TEST_PEER_ID_PREFIX__ =
					`pr-test-w${workerIndex}-`;
			}
		},
		{ timings: TEST_TIMINGS, workerIndex: options.workerIndex, useMock }
	);
}

/**
 * Inject test config into a page (uses the page's context).
 */
export async function injectTestConfig(page: Page, workerIndex?: number): Promise<void> {
	await injectTestConfigToContext(page.context(), workerIndex);
}
