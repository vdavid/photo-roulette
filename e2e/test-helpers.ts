/**
 * Shared test helpers for all E2E tests.
 * Includes PeerJS mock and timing overrides for fast test execution.
 */

import type { Page, BrowserContext } from '@playwright/test';
import { injectPeerJsMockToContext } from './peerjs-mock';

/**
 * Inject all test overrides into a browser context.
 * Includes PeerJS mock and timing overrides for both games.
 */
export async function injectTestConfigToContext(context: BrowserContext): Promise<void> {
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
export async function injectTestConfig(page: Page): Promise<void> {
	await injectTestConfigToContext(page.context());
}
