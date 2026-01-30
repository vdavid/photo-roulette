/**
 * Shared test helpers for all E2E tests.
 * Includes PeerJS mock and timing overrides for fast test execution.
 */

import type { Page, BrowserContext } from '@playwright/test';
import { injectPeerJsMockToContext } from './peerjs-mock';

/** Base port for WebSocket bridge servers */
const BASE_WS_PORT = 9876;

export interface TestConfigOptions {
	/** Use WebSocket bridge for multi-browser tests (contexts need to communicate) */
	multiBrowser?: boolean;
	/** Port for the WebSocket bridge (for parallel workers). Defaults to 9876. */
	bridgePort?: number;
}

/**
 * Inject all test overrides into a browser context.
 * Includes PeerJS mock and timing overrides for both games.
 *
 * For single-browser tests: Uses in-memory mock (fastest)
 * For multi-browser tests: Uses WebSocket bridge mock (contexts can communicate)
 */
export async function injectTestConfigToContext(
	context: BrowserContext,
	options?: TestConfigOptions
): Promise<void> {
	// For multi-browser tests, inject WebSocket URL so mock uses the bridge
	if (options?.multiBrowser) {
		const port = options.bridgePort ?? BASE_WS_PORT;
		const wsUrl = `ws://localhost:${port}`;
		await context.addInitScript(
			(url) => {
				(window as unknown as Record<string, string>).__PEERJS_WS_URL__ = url;
			},
			wsUrl
		);
	}

	// Inject PeerJS mock first (must be before any page loads)
	await injectPeerJsMockToContext(context);

	// Inject timing overrides for both games
	await context.addInitScript(() => {
		// Photo Roulette timing override
		(window as unknown as Record<string, number>).__TEST_RESULT_DISPLAY_MS__ = 100;
		// Hot Takes timing overrides
		(window as unknown as Record<string, number>).__TEST_HOT_TAKES_REVEAL_MS__ = 100;
		(window as unknown as Record<string, number>).__TEST_HOT_TAKES_VOTING_SECONDS__ = 2;
		(window as unknown as Record<string, number>).__TEST_HOT_TAKES_GUESSING_SECONDS__ = 2;
	});
}

/**
 * Inject test config into a page (uses the page's context).
 */
export async function injectTestConfig(page: Page, options?: TestConfigOptions): Promise<void> {
	await injectTestConfigToContext(page.context(), options);
}
