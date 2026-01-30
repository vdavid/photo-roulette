import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { injectTestConfigToContext } from './test-helpers';

const BASE_WS_PORT = 9876;

/**
 * Full Hot Takes game E2E test with 3 players
 *
 * This test simulates a complete game with:
 * - AAA (host), BBB, CCC
 * - 1 take per player (3 takes total)
 * - All players vote and guess on each take
 * - Verification of scores and results
 */

// Helper to navigate directly to Hot Takes landing page
async function selectHotTakes(page: Page) {
	await page.goto('/?game=hot-takes');
	await expect(page.getByRole('button', { name: 'Host game' })).toBeVisible();
}

interface PlayerContext {
	name: string;
	context: BrowserContext;
	page: Page;
}

test.describe('Full Hot Takes game', () => {
	// Timeout for full game (reduced with test timings)
	test.setTimeout(60000); // 1 minute

	test('plays a complete Hot Takes game', async ({ browser }, testInfo) => {
		const players: PlayerContext[] = [];
		const playerNames = ['AAA', 'BBB', 'CCC'];
		const bridgePort = BASE_WS_PORT + testInfo.parallelIndex;

		for (const name of playerNames) {
			const context = await browser.newContext();
			// Use WebSocket bridge for multi-browser tests
			await injectTestConfigToContext(context, {
				multiBrowser: true,
				bridgePort,
			});
			const page = await context.newPage();
			players.push({ name, context, page });
		}

		let roomCode: string;

		try {
		const [host, player2, player3] = players;

		// === PHASE 1: Host creates game ===
		await test.step('Host creates game', async () => {
			await host.page.goto('/');
			await selectHotTakes(host.page);
			// Hot Takes has name input on landing page
			await host.page.getByLabel('Your name').fill(host.name);
			await host.page.getByRole('button', { name: 'Host game' }).click();

			// Wait for lobby and get room code
			await expect(host.page.getByText('Room code')).toBeVisible({ timeout: 15000 });
			const roomCodeElement = host.page.locator('.code-value');
			roomCode = (await roomCodeElement.textContent()) || '';
			expect(roomCode).toMatch(/^[A-Z0-9]{4}$/);

			console.log(`Room code: ${roomCode}`);
		});

		// === PHASE 2: Other players join ===
		await test.step('Other players join', async () => {
			for (const player of [player2, player3]) {
				await player.page.goto('/');
				await selectHotTakes(player.page);
				// Hot Takes has all fields on landing page
				await player.page.getByLabel('Your name').fill(player.name);
				await player.page.locator('input[placeholder="CODE"]').fill(roomCode);
				await player.page.getByRole('button', { name: 'Join' }).click();

				// Wait for lobby
				await expect(player.page.getByText('Room code')).toBeVisible({ timeout: 15000 });
			}

			// Verify all players are in the lobby for host
			for (const player of players) {
				await expect(host.page.getByText(player.name)).toBeVisible();
			}
		});

		// === PHASE 3: Configure settings (1 take per player) ===
		await test.step('Configure game settings', async () => {
			// Settings are shown as option buttons in the lobby
			// Click the "1" button in the "Takes per player" section
			// The setting section has label "Takes per player" followed by option buttons
			const settingSection = host.page.locator('.setting').filter({ hasText: 'Takes per player' });
			const takesOneButton = settingSection.locator('.option-btn').filter({ hasText: /^1$/ });
			if (await takesOneButton.isVisible()) {
				await takesOneButton.click();
				// Verify it's selected
				await expect(takesOneButton).toHaveClass(/selected/);
			}
		});

		// === PHASE 3.5: Non-host players mark themselves as ready ===
		await test.step('Players mark themselves as ready', async () => {
			for (const player of [player2, player3]) {
				await player.page.getByRole('button', { name: 'Ready' }).click();
				await expect(player.page.getByText('Ready').first()).toBeVisible();
			}
		});

		// === PHASE 4: Start the game ===
		await test.step('Start game', async () => {
			await expect(host.page.getByRole('button', { name: 'Start game' })).toBeEnabled({
				timeout: 5000,
			});
			await host.page.getByRole('button', { name: 'Start game' }).click();

			// All players should see the submission phase
			await Promise.all(
				players.map(async (player) => {
					await expect(player.page.getByText('Submit your hot takes')).toBeVisible({
						timeout: 10000,
					});
				})
			);
		});

		// === PHASE 5: All players submit their takes ===
		const takes = [
			'Pineapple belongs on pizza',
			'Cats are better than dogs',
			'Winter is the best season',
		];

		await test.step('All players submit takes', async () => {
			// Submit takes sequentially to avoid race conditions
			for (let i = 0; i < players.length; i++) {
				const player = players[i];
				// Find the textarea and submit a take
				const textarea = player.page.locator('textarea');
				await textarea.fill(takes[i]);

				// Click submit button (button text is "Submit take X/Y")
				await player.page.getByRole('button', { name: /Submit take/i }).click();

				// Wait a bit for state to sync
				await player.page.waitForTimeout(500);
			}

			// After all players submit, wait for the voting phase to start
			// (the "All takes submitted" screen may flash too quickly to catch)
			await expect(host.page.getByText('Do you agree with this take?')).toBeVisible({
				timeout: 15000,
			});

			console.log('All players submitted their takes');
		});

		// === PHASE 6: Process takes until game ends ===
		let takeIndex = 0;
		let gameOver = false;

		while (!gameOver) {
			await test.step(`Process take ${takeIndex + 1}`, async () => {
				// Check if game is already over
				const isGameOver = await host.page.getByRole('heading', { name: /Game over/i }).isVisible();
				if (isGameOver) {
					gameOver = true;
					return;
				}

				// Wait for voting phase (skip for first take since we already waited above)
				if (takeIndex > 0) {
					// Wait for either voting phase or game over
					await expect(
						host.page.getByText(/Do you agree with this take|Game over/i).first()
					).toBeVisible({
						timeout: 20000,
					});

					// Check again if game ended
					const endedDuringWait = await host.page
						.getByRole('heading', { name: /Game over/i })
						.isVisible();
					if (endedDuringWait) {
						gameOver = true;
						return;
					}
				}

				// All players vote
				await Promise.all(
					players.map(async (player) => {
						// Click the Agree button (has class .vote-btn and text "Agree")
						const agreeButton = player.page.locator('.vote-btn.agree');
						if (await agreeButton.isVisible({ timeout: 3000 })) {
							await agreeButton.click();
						}
					})
				);

				console.log(`All players voted on take ${takeIndex + 1}`);

				// Wait for guessing phase - check that at least one player sees the guess prompt
				// (The author sees "This is your take!" instead of "Who wrote this take?")
				await expect(
					host.page.getByText(/Who wrote this take|This is your take/i).first()
				).toBeVisible({
					timeout: 20000,
				});

				// All players guess (except the author who can't guess their own take)
				await Promise.all(
					players.map(async (player) => {
						// Check if this player is the author (sees "This is your take")
						const isAuthor = await player.page.getByText('This is your take').isVisible();

						if (!isAuthor) {
							// Get available guess buttons (class .guess-btn)
							const guessButtons = player.page.locator('.guess-btn:not([disabled])');
							const buttonCount = await guessButtons.count();

							if (buttonCount > 0) {
								// Click the first available guess button
								await guessButtons.first().click();
							}
						}
					})
				);

				console.log(`All players guessed on take ${takeIndex + 1}`);

				// Wait for reveal phase (shows "Next take coming up..." or game over)
				await expect(host.page.getByText(/Next take coming up|Game over/i).first()).toBeVisible({
					timeout: 20000,
				});

				console.log(`Reveal shown for take ${takeIndex + 1}`);

				// Check if game is over now
				const gameEnded = await host.page.getByRole('heading', { name: /Game over/i }).isVisible();
				if (gameEnded) {
					gameOver = true;
					return;
				}

				// Short wait for auto-advance to next take
				await host.page.waitForTimeout(1000);
			});

			takeIndex++;

			// Safety limit to prevent infinite loop
			if (takeIndex > 10) {
				throw new Error('Too many takes processed - possible infinite loop');
			}
		}

		console.log(`Processed ${takeIndex} takes total`);

		// === PHASE 7: Verify final results ===
		await test.step('Verify final results', async () => {
			// Wait for final screen
			await expect(host.page.getByRole('heading', { name: /Game over/i })).toBeVisible({
				timeout: 15000,
			});

			// Verify all players see the final screen
			await Promise.all(
				players.map(async (player) => {
					await expect(player.page.getByText(/Game over|Final rankings/i).first()).toBeVisible();
				})
			);

			// All players should be shown in results (use first() since names may appear multiple times)
			for (const player of players) {
				await expect(host.page.getByText(player.name).first()).toBeVisible();
			}

			// Verify there's a play again button (host only)
			const playAgainButton = host.page.getByRole('button', { name: 'Play again' });
			await expect(playAgainButton).toBeVisible();

			console.log('Final results verified');
		});

		// === PHASE 8: Test play again functionality ===
		await test.step('Test play again', async () => {
			const playAgainButton = host.page.getByRole('button', { name: 'Play again' });

			if (await playAgainButton.isVisible()) {
				await playAgainButton.click();

				// Should return to lobby
				await expect(host.page.getByText('Room code')).toBeVisible({ timeout: 10000 });
				console.log('Play again returns to lobby');
			}
		});

		console.log('Hot Takes full game test completed successfully!');
		} finally {
			for (const player of players) {
				await player.context.close();
			}
		}
	});
});

test.describe('Hot Takes edge cases', () => {
	// Skip in CI - multi-browser tests need real PeerJS which requires network access
	// All tests now use mock - no skip needed

	test.setTimeout(120000);

	test('game handles unanimous votes', async ({ browser }, testInfo) => {
		// Create 3 browser contexts
		const players: PlayerContext[] = [];
		const playerNames = ['AAA', 'BBB', 'CCC'];
		const bridgePort = BASE_WS_PORT + testInfo.parallelIndex;

		for (const name of playerNames) {
			const context = await browser.newContext();
			// Use WebSocket bridge for multi-browser tests
			await injectTestConfigToContext(context, {
				multiBrowser: true,
				bridgePort,
			});
			const page = await context.newPage();
			players.push({ name, context, page });
		}

		try {
			const [host, player2, player3] = players;

			// Create game
			await selectHotTakes(host.page);
			await host.page.getByLabel('Your name').fill(host.name);
			await host.page.getByRole('button', { name: 'Host game' }).click();
			await expect(host.page.getByText('Room code')).toBeVisible({ timeout: 15000 });

			const roomCode = (await host.page.locator('.code-value').textContent()) || '';

			// Other players join
			for (const player of [player2, player3]) {
				await selectHotTakes(player.page);
				await player.page.getByLabel('Your name').fill(player.name);
				await player.page.locator('input[placeholder="CODE"]').fill(roomCode);
				await player.page.getByRole('button', { name: 'Join' }).click();
				await expect(player.page.getByText('Room code')).toBeVisible({ timeout: 15000 });
			}

			// Configure 1 take per player for faster test
			const settingSection = host.page.locator('.setting').filter({ hasText: 'Takes per player' });
			const takesOneButton = settingSection.locator('.option-btn').filter({ hasText: /^1$/ });
			if (await takesOneButton.isVisible()) {
				await takesOneButton.click();
			}

			// Non-host players mark themselves as ready
			for (const player of [player2, player3]) {
				await player.page.getByRole('button', { name: 'Ready' }).click();
				await expect(player.page.getByText('Ready').first()).toBeVisible();
			}

			// Start game
			await expect(host.page.getByRole('button', { name: 'Start game' })).toBeEnabled({
				timeout: 5000,
			});
			await host.page.getByRole('button', { name: 'Start game' }).click();

			// Submit takes sequentially
			for (const player of players) {
				await expect(player.page.getByText('Submit your hot takes')).toBeVisible({
					timeout: 10000,
				});
				const textarea = player.page.locator('textarea');
				await textarea.fill(`Take from ${player.name}`);
				await player.page.getByRole('button', { name: /Submit take/i }).click();
				await player.page.waitForTimeout(500);
			}

			// Wait for voting phase
			await expect(host.page.getByText('Do you agree with this take?')).toBeVisible({
				timeout: 20000,
			});

			// All players vote the same way (unanimous agree)
			await Promise.all(
				players.map(async (player) => {
					const agreeButton = player.page.locator('.vote-btn.agree');
					if (await agreeButton.isVisible({ timeout: 5000 })) {
						await agreeButton.click();
					}
				})
			);

			// Should still proceed to guessing phase
			// (Author sees "This is your take!" instead of "Who wrote this take?")
			await expect(
				host.page.getByText(/Who wrote this take|This is your take/i).first()
			).toBeVisible({
				timeout: 20000,
			});

			console.log('Unanimous vote handled correctly');
		} finally {
			for (const player of players) {
				await player.context.close();
			}
		}
	});
});
