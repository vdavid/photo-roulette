import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Real PeerJS E2E test - no mocking!
 *
 * This test uses the actual PeerJS cloud server to verify true end-to-end
 * connectivity. It runs in parallel with mocked tests and provides confidence
 * that the real networking stack works.
 *
 * Keep this test simple to minimize flakiness from network variability.
 */

// Helper to navigate to Hot Takes
async function selectHotTakes(page: Page) {
	await page.locator('.game-card').filter({ hasText: 'Hot Takes' }).click();
	await expect(page.getByRole('heading', { name: 'Hot Takes' })).toBeVisible();
}

interface PlayerContext {
	name: string;
	context: BrowserContext;
	page: Page;
}

test.describe('Real PeerJS connectivity', () => {
	// Longer timeout for real network operations
	test.setTimeout(90000);

	// Allow retries for this flaky network test
	test.describe.configure({ retries: 2 });

	test('host and player can connect via real PeerJS', async ({ browser }) => {
		const players: PlayerContext[] = [];

		// Create 2 browser contexts (no mock injection!)
		for (const name of ['Host', 'Player']) {
			const context = await browser.newContext();
			// Only inject timing overrides, NOT the PeerJS mock
			await context.addInitScript(() => {
				// Fast timings for test
				(window as unknown as Record<string, number>).__TEST_HOT_TAKES_REVEAL_MS__ = 100;
				(window as unknown as Record<string, number>).__TEST_HOT_TAKES_VOTING_SECONDS__ = 2;
				(window as unknown as Record<string, number>).__TEST_HOT_TAKES_GUESSING_SECONDS__ = 2;
			});
			const page = await context.newPage();
			players.push({ name, context, page });
		}

		const [host, player] = players;

		try {
			// Host creates game
			await host.page.goto('/');
			await selectHotTakes(host.page);
			await host.page.getByLabel('Your name').fill(host.name);
			await host.page.getByRole('button', { name: 'Host game' }).click();

			// Wait for lobby with real PeerJS (may take longer)
			await expect(host.page.getByText('Room code')).toBeVisible({ timeout: 20000 });
			const roomCode = await host.page.locator('.code-value').textContent();
			expect(roomCode).toMatch(/^[A-Z0-9]{4}$/);

			console.log(`[Real PeerJS] Room code: ${roomCode}`);

			// Player joins
			await player.page.goto('/');
			await selectHotTakes(player.page);
			await player.page.getByLabel('Your name').fill(player.name);
			await player.page.locator('input[placeholder="CODE"]').fill(roomCode!);
			await player.page.getByRole('button', { name: 'Join' }).click();

			// Wait for player to reach lobby (real network connection)
			await expect(player.page.getByText('Room code')).toBeVisible({ timeout: 20000 });

			// Verify both players see each other in the player list
			await expect(host.page.getByText('Player', { exact: true })).toBeVisible({ timeout: 5000 });
			await expect(player.page.getByText('Host', { exact: true })).toBeVisible({ timeout: 5000 });

			console.log('[Real PeerJS] Connection successful - both players in lobby!');
		} finally {
			for (const p of players) {
				try {
					await p.context.close();
				} catch {
					// Context may already be closed
				}
			}
		}
	});
});
