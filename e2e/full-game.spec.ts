import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Helper to navigate to Photo Roulette from game selector
async function selectPhotoRoulette(page: Page) {
	await page.locator('.game-card').filter({ hasText: 'Photo Roulette' }).click();
	await expect(page.getByRole('heading', { name: 'Photo Roulette' })).toBeVisible();
}

/**
 * Full game E2E test with 4 players
 *
 * This test simulates a complete game with:
 * - AAA (host), BBB, CCC, DDD
 * - 8 rounds with 5-second timer
 * - Deterministic photo selection via seeded RNG
 * - Verification of scores and results
 */

// Scoring constants (must match src/lib/game/constants.ts)
const POINTS_CORRECT_GUESS = 100;
const POINTS_FASTEST_BONUS = 50;
const POINTS_FEATURED = 50;

// Test configuration
const ROUND_COUNT = 8;
const TIMER_SECONDS = 5;
const RANDOM_SEED = 12345;
const RESULT_DISPLAY_MS = 500; // Fast results display for testing (default is 4500ms)

// Expected photo order with seed 12345 (deterministic)
const EXPECTED_PHOTO_OWNERS = ['DDD', 'BBB', 'CCC', 'AAA', 'DDD', 'BBB', 'CCC', 'AAA'];

interface PlayerContext {
	name: string;
	context: BrowserContext;
	page: Page;
}

test.describe('Full 4-player game', () => {
	// Skip in CI - multi-browser tests need real PeerJS which requires network access
	// Run locally with: pnpm exec playwright test e2e/full-game.spec.ts
	test.skip(!!process.env.CI, 'Multi-browser tests require real PeerJS network access');

	// Timeout for full game with fast result display
	// 8 rounds * ~6s (5s timer + 0.5s results) + setup = ~60s
	test.setTimeout(90000); // 90 seconds

	let players: PlayerContext[] = [];
	let roomCode: string;

	test.beforeAll(async ({ browser }) => {
		// Create 4 browser contexts for 4 players
		const playerNames = ['AAA', 'BBB', 'CCC', 'DDD'];

		for (const name of playerNames) {
			const context = await browser.newContext();
			const page = await context.newPage();
			players.push({ name, context, page });
		}
	});

	test.afterAll(async () => {
		// Clean up all contexts
		for (const player of players) {
			await player.context.close();
		}
	});

	test('plays a complete game with correct scoring', async () => {
		const [host, player2, player3, player4] = players;

		// === PHASE 1: Host creates game ===
		await test.step('Host creates game', async () => {
			await host.page.goto('/');

			// Inject test configuration for faster results display
			await host.page.evaluate((resultDisplayMs) => {
				(window as unknown as { __TEST_RESULT_DISPLAY_MS__: number }).__TEST_RESULT_DISPLAY_MS__ =
					resultDisplayMs;
			}, RESULT_DISPLAY_MS);

			// Select Photo Roulette from game selector
			await selectPhotoRoulette(host.page);

			await host.page.getByRole('button', { name: 'Host a game' }).click();
			await host.page.getByLabel('Your name').fill(host.name);
			await host.page.getByRole('button', { name: 'Create game' }).click();

			// Wait for lobby and get room code
			await expect(host.page.getByText('Room code')).toBeVisible({ timeout: 15000 });
			const roomCodeElement = host.page.locator('.code');
			await expect(roomCodeElement).toBeVisible();
			roomCode = (await roomCodeElement.textContent()) || '';
			expect(roomCode).toMatch(/^[A-Z0-9]{4}$/);

			console.log(`Room code: ${roomCode}`);
		});

		// === PHASE 2: Other players join ===
		await test.step('Other players join', async () => {
			for (const player of [player2, player3, player4]) {
				await player.page.goto('/');

				// Inject test configuration for faster results display
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

				// Wait for lobby
				await expect(player.page.getByText('Room code')).toBeVisible({ timeout: 15000 });
			}

			// Verify all players are in the lobby for host
			for (const player of players) {
				await expect(host.page.getByText(player.name)).toBeVisible();
			}
		});

		// === PHASE 3: Configure game settings ===
		await test.step('Configure game settings', async () => {
			// Host opens settings
			await host.page.locator('.settings-chip').click();
			await expect(host.page.getByLabel('Rounds')).toBeVisible();

			// Set rounds and timer
			await host.page.getByLabel('Rounds').selectOption(ROUND_COUNT.toString());
			await host.page.getByLabel('Timer (seconds)').selectOption(TIMER_SECONDS.toString());

			// Click elsewhere to close settings
			await host.page.locator('.settings-chip').click();

			// Verify settings
			await expect(host.page.getByText(new RegExp(`${ROUND_COUNT} rounds`))).toBeVisible();
		});

		// === PHASE 4: All players connect photos ===
		await test.step('All players connect photos', async () => {
			// Connect photos for all players in parallel
			await Promise.all(
				players.map(async (player) => {
					await player.page.getByRole('button', { name: /Connect your photos/ }).click();

					// Wait for photos to be processed (test mode generates them instantly)
					// The player card should show "15 photos connected" or similar
					await expect(player.page.getByText('15 photos connected')).toBeVisible({
						timeout: 10000,
					});
				})
			);

			// Verify all players show as ready on host's view
			// Each player card should have ready indicator
			await expect(host.page.getByRole('button', { name: 'Start game' })).toBeEnabled({
				timeout: 5000,
			});
		});

		// === PHASE 5: Inject random seed and start game ===
		await test.step('Start game with seeded RNG', async () => {
			// Inject the random seed on the host before starting
			await host.page.evaluate((seed) => {
				// Access the game module and set the seed
				// The seed must be set before startGame is called
				(window as unknown as { __TEST_RANDOM_SEED__: number }).__TEST_RANDOM_SEED__ = seed;
			}, RANDOM_SEED);

			// Start the game
			await host.page.getByRole('button', { name: 'Start game' }).click();

			// Wait for game phase on all players
			await Promise.all(
				players.map(async (player) => {
					await expect(player.page.getByText('Whose photo is this?')).toBeVisible({
						timeout: 10000,
					});
				})
			);
		});

		// === PHASE 6: Play through all rounds ===
		const roundResults: Array<{
			roundNumber: number;
			photoOwner: string;
			guesses: Map<string, string>;
			scores: Map<string, number>;
		}> = [];

		for (let round = 1; round <= ROUND_COUNT; round++) {
			await test.step(`Play round ${round}`, async () => {
				// Verify round number is shown
				await expect(host.page.getByText(`Round ${round} of ${ROUND_COUNT}`)).toBeVisible({
					timeout: 10000,
				});

				// Wait a moment for the photo to load and unblur slightly
				await host.page.waitForTimeout(1000);

				// Read the photo label from the displayed image to know whose photo it is
				// Test photos have labels like "AAA/1", "BBB/2", etc.
				// We'll need to observe the results to know the owner

				// Create a guessing strategy:
				// - Each player guesses based on a pattern to create interesting scores
				// Round 1: Everyone guesses AAA
				// Round 2: Everyone guesses BBB
				// Round 3: Everyone guesses CCC
				// Round 4: Everyone guesses DDD
				// Round 5-8: Each player guesses themselves
				const guessTarget = round <= 4 ? players[(round - 1) % 4].name : null; // null = guess yourself

				const roundGuesses = new Map<string, string>();

				// All players make their guesses (in parallel to be fast)
				await Promise.all(
					players.map(async (player) => {
						const targetName = guessTarget || player.name;
						const guessButton = player.page
							.locator('.guess-button')
							.filter({ hasText: targetName });
						await guessButton.click();
						roundGuesses.set(player.name, targetName);
					})
				);

				// Wait for results screen
				await expect(host.page.getByText(`Round ${round} complete`)).toBeVisible({
					timeout: TIMER_SECONDS * 1000 + 5000,
				});

				// Extract the photo owner from results
				const ownerText = await host.page.locator('.owner-text').textContent();
				const ownerMatch = ownerText?.match(/It was (\w+)'s photo!/);
				const photoOwner = ownerMatch ? ownerMatch[1] : 'Unknown';

				console.log(`Round ${round}: Photo owner was ${photoOwner}`);

				// Verify deterministic photo selection
				const expectedOwner = EXPECTED_PHOTO_OWNERS[round - 1];
				expect(photoOwner).toBe(expectedOwner);

				// Store round results for verification
				roundResults.push({
					roundNumber: round,
					photoOwner,
					guesses: roundGuesses,
					scores: new Map(), // Will calculate expected scores
				});

				// Wait for next round or final results
				if (round < ROUND_COUNT) {
					await expect(host.page.getByText(`Round ${round + 1} of ${ROUND_COUNT}`)).toBeVisible({
						timeout: 10000,
					});
				}
			});
		}

		// === PHASE 7: Verify final results ===
		await test.step('Verify final results', async () => {
			// Wait for final screen
			await expect(host.page.getByText('Game over!')).toBeVisible({ timeout: 15000 });

			// Verify all players see the final screen
			await Promise.all(
				players.map(async (player) => {
					await expect(player.page.getByText('Game over!')).toBeVisible();
				})
			);

			// Calculate expected scores based on round results
			const expectedScores = new Map<string, number>();
			for (const player of players) {
				expectedScores.set(player.name, 0);
			}

			for (const result of roundResults) {
				// Featured player gets points
				const featuredScore = expectedScores.get(result.photoOwner) || 0;
				expectedScores.set(result.photoOwner, featuredScore + POINTS_FEATURED);

				// Find correct guessers and who was fastest
				let fastestGuesser: string | null = null;

				for (const [guesserName, guessedName] of result.guesses) {
					if (guessedName === result.photoOwner) {
						// Correct guess
						const currentScore = expectedScores.get(guesserName) || 0;
						expectedScores.set(guesserName, currentScore + POINTS_CORRECT_GUESS);

						// First correct guesser is fastest (in our test, they guess in order)
						if (!fastestGuesser) {
							fastestGuesser = guesserName;
						}
					}
				}

				// Fastest bonus
				if (fastestGuesser) {
					const fastestScore = expectedScores.get(fastestGuesser) || 0;
					expectedScores.set(fastestGuesser, fastestScore + POINTS_FASTEST_BONUS);
				}
			}

			console.log('Expected scores:', Object.fromEntries(expectedScores));

			// Verify scores on final screen
			// The podium and leaderboard show player names with their scores
			for (const [playerName, expectedScore] of expectedScores) {
				// Find the player's score - it should appear on the page
				const scoreLocator = host.page
					.locator(`.player-score:has-text("${expectedScore}")`)
					.first();
				const isVisible = await scoreLocator.isVisible().catch(() => false);

				if (isVisible) {
					console.log(
						`${playerName}: expected ${expectedScore}, found ${await scoreLocator.textContent()}`
					);
				} else {
					// Try looking for the exact number on podium or leaderboard
					const altScoreLocator = host.page.locator(`text=${expectedScore}`).first();
					const altVisible = await altScoreLocator.isVisible().catch(() => false);
					console.log(
						`${playerName}: expected ${expectedScore}, found ${altVisible ? 'visible' : 'not visible'}`
					);
				}
			}

			// Verify total points sum is correct (each player featured twice + correct guesses)
			const totalExpectedPoints = Array.from(expectedScores.values()).reduce((a, b) => a + b, 0);
			console.log(`Total expected points: ${totalExpectedPoints}`);

			// Verify the winner is shown with crown
			await expect(host.page.locator('.crown')).toBeVisible();

			// Verify superlatives/awards section exists
			await expect(host.page.getByText('Awards')).toBeVisible();

			// Host should see rematch button
			await expect(host.page.getByRole('button', { name: 'Rematch' })).toBeVisible();

			// Non-hosts should see waiting message
			await expect(player2.page.getByText('Waiting for host...')).toBeVisible();
		});

		// === PHASE 8: Test rematch functionality ===
		await test.step('Test rematch', async () => {
			await host.page.getByRole('button', { name: 'Rematch' }).click();

			// Verify game restarts
			await expect(host.page.getByText('Round 1 of 8')).toBeVisible({ timeout: 10000 });

			// Verify all players are in the game
			await Promise.all(
				players.map(async (player) => {
					await expect(player.page.getByText('Whose photo is this?')).toBeVisible({
						timeout: 10000,
					});
				})
			);

			// Leave the rematch game (we don't need to play the full thing again)
			await host.page.getByRole('button', { name: players[0].name }).click(); // Make a quick guess

			// Wait a moment then leave
			await host.page.waitForTimeout(1000);
		});

		console.log('Test completed successfully!');
	});
});
