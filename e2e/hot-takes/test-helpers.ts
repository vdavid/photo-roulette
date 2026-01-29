import type { Page } from '@playwright/test';

/**
 * Test timing configuration for Hot Takes E2E tests.
 * These values can be overridden by injecting window variables.
 */
export const TEST_TIMINGS = {
	/** Reveal display time in ms (default: 5000ms, test: 200ms) */
	REVEAL_MS: 200,
	/** Voting time in seconds (default: 10-30s, test: 2s) */
	VOTING_SECONDS: 2,
	/** Guessing time in seconds (default: 15-45s, test: 2s) */
	GUESSING_SECONDS: 2,
};

/**
 * Inject test timing overrides into a page before navigating to Hot Takes.
 * This dramatically speeds up tests by reducing wait times.
 */
export async function injectTestTimings(page: Page): Promise<void> {
	await page.addInitScript((timings) => {
		(window as unknown as Record<string, number>).__TEST_HOT_TAKES_REVEAL_MS__ = timings.REVEAL_MS;
		(window as unknown as Record<string, number>).__TEST_HOT_TAKES_VOTING_SECONDS__ =
			timings.VOTING_SECONDS;
		(window as unknown as Record<string, number>).__TEST_HOT_TAKES_GUESSING_SECONDS__ =
			timings.GUESSING_SECONDS;
	}, TEST_TIMINGS);
}
