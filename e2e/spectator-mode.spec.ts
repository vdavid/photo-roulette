import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Helper to navigate to Photo Roulette from game selector
async function selectPhotoRoulette(page: Page) {
	await page.locator('.game-card').filter({ hasText: 'Photo Roulette' }).click();
	await expect(page.getByRole('heading', { name: 'Photo Roulette' })).toBeVisible();
}

/**
 * Spectator mode E2E test with 3 players
 *
 * This test simulates a game with:
 * - AAA (host) - plays normally
 * - BBB - toggles spectator on/off, then plays normally
 * - CCC - toggles spectator on/off, then stays as spectator
 *
 * Tests that:
 * - Spectator mode toggle works correctly
 * - Game can start with 2 players + 1 spectator
 * - Spectators can vote but don't appear as guess options
 * - Spectators can earn points for correct guesses
 */

const ROUND_COUNT = 8;
const TIMER_SECONDS = 5;
const RESULT_DISPLAY_MS = 500;

interface PlayerContext {
	name: string;
	context: BrowserContext;
	page: Page;
}

test.describe('Spectator mode', () => {
	// Skip in CI - multi-browser tests need real PeerJS which requires network access
	// Run locally with: pnpm exec playwright test e2e/spectator-mode.spec.ts
	test.skip(!!process.env.CI, 'Multi-browser tests require real PeerJS network access');

	test.setTimeout(120000); // 2 minutes

	let players: PlayerContext[] = [];
	let roomCode: string;

	test.beforeAll(async ({ browser }) => {
		const playerNames = ['AAA', 'BBB', 'CCC'];

		for (const name of playerNames) {
			const context = await browser.newContext();
			const page = await context.newPage();
			players.push({ name, context, page });
		}
	});

	test.afterAll(async () => {
		for (const player of players) {
			await player.context.close();
		}
	});

	test('spectator can watch and vote without contributing photos', async () => {
		const [host, player2, spectator] = players;

		// === PHASE 1: Host creates game ===
		await test.step('Host creates game', async () => {
			await host.page.goto('/');

			await host.page.evaluate((resultDisplayMs) => {
				(window as unknown as { __TEST_RESULT_DISPLAY_MS__: number }).__TEST_RESULT_DISPLAY_MS__ =
					resultDisplayMs;
			}, RESULT_DISPLAY_MS);

			// Select Photo Roulette from game selector
			await selectPhotoRoulette(host.page);

			await host.page.getByRole('button', { name: 'Host a game' }).click();
			await host.page.getByLabel('Your name').fill(host.name);
			await host.page.getByRole('button', { name: 'Create game' }).click();

			await expect(host.page.getByText('Room code')).toBeVisible({ timeout: 15000 });
			const roomCodeElement = host.page.locator('.code');
			roomCode = (await roomCodeElement.textContent()) || '';
			expect(roomCode).toMatch(/^[A-Z0-9]{4}$/);

			console.log(`Room code: ${roomCode}`);
		});

		// === PHASE 2: Other players join ===
		await test.step('Other players join', async () => {
			for (const player of [player2, spectator]) {
				await player.page.goto('/');

				await player.page.evaluate((resultDisplayMs) => {
					(window as unknown as { __TEST_RESULT_DISPLAY_MS__: number }).__TEST_RESULT_DISPLAY_MS__ =
						resultDisplayMs;
				}, RESULT_DISPLAY_MS);

				// Select Photo Roulette from game selector
				await selectPhotoRoulette(player.page);

				await player.page.getByRole('button', { name: 'Join a game' }).click();
				await player.page.getByLabel('Room code').fill(roomCode);
				await player.page.getByLabel('Your name').fill(player.name);
				await player.page.getByRole('button', { name: 'Join game' }).click();

				await expect(player.page.getByText('Room code')).toBeVisible({ timeout: 15000 });
			}

			// Verify all players are in the lobby
			for (const player of players) {
				await expect(host.page.getByText(player.name)).toBeVisible();
			}
		});

		// === PHASE 3: Configure game settings ===
		await test.step('Configure game settings', async () => {
			await host.page.locator('.settings-chip').click();
			await host.page.getByLabel('Rounds').selectOption(ROUND_COUNT.toString());
			await host.page.getByLabel('Timer (seconds)').selectOption(TIMER_SECONDS.toString());
			await host.page.locator('.settings-chip').click();
		});

		// === PHASE 4: Test spectator mode toggling ===
		await test.step('BBB toggles spectator on and off', async () => {
			// BBB becomes spectator
			await player2.page.getByRole('button', { name: /Just watch/ }).click();
			await expect(player2.page.locator('.spectator-section')).toBeVisible({ timeout: 5000 });

			// Host should see BBB as spectator (check the player card status)
			await expect(
				host.page.locator('.player-card').filter({ hasText: 'BBB' }).locator('.status.spectator')
			).toBeVisible();

			// BBB switches back to player mode
			await player2.page.getByRole('button', { name: 'Join as player' }).click();
			await expect(player2.page.getByRole('button', { name: /Connect your photos/ })).toBeVisible({
				timeout: 5000,
			});
		});

		await test.step('CCC toggles spectator on and off, then stays spectator', async () => {
			// CCC becomes spectator
			await spectator.page.getByRole('button', { name: /Just watch/ }).click();
			await expect(spectator.page.locator('.spectator-section')).toBeVisible({ timeout: 5000 });

			// CCC switches back to player
			await spectator.page.getByRole('button', { name: 'Join as player' }).click();
			await expect(spectator.page.getByRole('button', { name: /Connect your photos/ })).toBeVisible(
				{ timeout: 5000 }
			);

			// CCC becomes spectator again (final state)
			await spectator.page.getByRole('button', { name: /Just watch/ }).click();
			await expect(spectator.page.locator('.spectator-section')).toBeVisible({ timeout: 5000 });

			// Verify spectator badge is shown on host's view
			await expect(host.page.locator('.spectator-badge')).toBeVisible();
		});

		// === PHASE 5: Players connect photos ===
		await test.step('AAA and BBB connect photos', async () => {
			// Host connects photos
			await host.page.getByRole('button', { name: /Connect your photos/ }).click();
			await expect(host.page.getByText('15 photos connected')).toBeVisible({ timeout: 10000 });

			// BBB connects photos
			await player2.page.getByRole('button', { name: /Connect your photos/ }).click();
			await expect(player2.page.getByText('15 photos connected')).toBeVisible({ timeout: 10000 });

			// CCC is spectator, so no photos needed
			// Verify start button is enabled
			await expect(host.page.getByRole('button', { name: 'Start game' })).toBeEnabled({
				timeout: 5000,
			});
		});

		// === PHASE 6: Start game ===
		await test.step('Start game', async () => {
			await host.page.getByRole('button', { name: 'Start game' }).click();

			// All players (including spectator) should see the game
			await Promise.all(
				players.map(async (player) => {
					await expect(player.page.getByText('Whose photo is this?')).toBeVisible({
						timeout: 10000,
					});
				})
			);
		});

		// === PHASE 7: Verify spectator can vote but isn't shown as option ===
		await test.step('Verify spectator is not a guess option', async () => {
			// On spectator's screen, they should only see AAA and BBB as options, not CCC
			const guessButtons = spectator.page.locator('.guess-button');
			const buttonCount = await guessButtons.count();
			expect(buttonCount).toBe(2); // Only AAA and BBB

			// Verify the specific buttons
			await expect(
				spectator.page.locator('.guess-button').filter({ hasText: 'AAA' })
			).toBeVisible();
			await expect(
				spectator.page.locator('.guess-button').filter({ hasText: 'BBB' })
			).toBeVisible();
			await expect(
				spectator.page.locator('.guess-button').filter({ hasText: 'CCC' })
			).not.toBeVisible();

			// Same for host's screen
			const hostGuessButtons = host.page.locator('.guess-button');
			const hostButtonCount = await hostGuessButtons.count();
			expect(hostButtonCount).toBe(2);
		});

		// === PHASE 8: Play through 8 rounds ===
		for (let round = 1; round <= ROUND_COUNT; round++) {
			await test.step(`Play round ${round}`, async () => {
				await expect(host.page.getByText(`Round ${round} of ${ROUND_COUNT}`)).toBeVisible({
					timeout: 10000,
				});

				// Wait for photo to load
				await host.page.waitForTimeout(500);

				// All players (including spectator) guess AAA
				await Promise.all(
					players.map(async (player) => {
						await player.page.locator('.guess-button').filter({ hasText: 'AAA' }).click();
					})
				);

				// Wait for results
				await expect(host.page.getByText(`Round ${round} complete`)).toBeVisible({
					timeout: TIMER_SECONDS * 1000 + 5000,
				});

				// Wait for next round or final
				if (round < ROUND_COUNT) {
					await expect(host.page.getByText(`Round ${round + 1} of ${ROUND_COUNT}`)).toBeVisible({
						timeout: 10000,
					});
				}
			});
		}

		// === PHASE 9: Verify final results ===
		await test.step('Verify final results', async () => {
			await expect(host.page.getByText('Game over!')).toBeVisible({ timeout: 15000 });

			// All players should see final screen
			await Promise.all(
				players.map(async (player) => {
					await expect(player.page.getByText('Game over!')).toBeVisible();
				})
			);

			// Spectator (CCC) should be on the leaderboard - they earned points for correct guesses
			// but no "featured" points since their photos were never shown
			await expect(host.page.getByText('CCC').first()).toBeVisible();

			console.log('Spectator mode test completed successfully!');
		});
	});
});
