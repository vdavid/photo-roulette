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

/** Base port for WebSocket bridge servers */
const BASE_WS_PORT = 9876;

export interface TestConfigOptions {
	/** Use WebSocket bridge for multi-browser tests (contexts need to communicate) */
	multiBrowser?: boolean;
	/** Worker index for unique peer ID prefixes */
	workerIndex?: number;
	/** Port for the WebSocket bridge (for parallel workers). Defaults to 9876. */
	bridgePort?: number;
}

/**
 * Inject all test overrides into a browser context.
 *
 * For single-browser tests: Uses in-memory mock (fastest)
 * For multi-browser tests: Uses WebSocket bridge mock (contexts can communicate)
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

	// For multi-browser tests, inject WebSocket URL so mock uses the bridge
	if (options.multiBrowser) {
		const port = options.bridgePort ?? BASE_WS_PORT;
		const wsUrl = `ws://localhost:${port}`;
		await context.addInitScript(
			(url) => {
				(window as unknown as Record<string, string>).__PEERJS_WS_URL__ = url;
			},
			wsUrl
		);
	}

	// Inject PeerJS mock (will use bridge if __PEERJS_WS_URL__ is set)
	await injectPeerJsMockToContext(context);

	// Inject timing overrides
	await context.addInitScript(
		({ timings }) => {
			// Hot Takes timing overrides
			(window as unknown as Record<string, number>).__TEST_HOT_TAKES_REVEAL_MS__ = timings.REVEAL_MS;
			(window as unknown as Record<string, number>).__TEST_HOT_TAKES_VOTING_SECONDS__ =
				timings.VOTING_SECONDS;
			(window as unknown as Record<string, number>).__TEST_HOT_TAKES_GUESSING_SECONDS__ =
				timings.GUESSING_SECONDS;
			// Photo Roulette timing override
			(window as unknown as Record<string, number>).__TEST_RESULT_DISPLAY_MS__ = 100;
		},
		{ timings: TEST_TIMINGS }
	);
}

/**
 * Inject test config into a page (uses the page's context).
 */
export async function injectTestConfig(page: Page, workerIndex?: number): Promise<void> {
	await injectTestConfigToContext(page.context(), workerIndex);
}
