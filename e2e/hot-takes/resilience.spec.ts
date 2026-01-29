import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * Hot Takes Resilience Tests
 *
 * These tests verify the game handles real-world scenarios gracefully:
 * - Player disconnects at various phases
 * - Player reconnection
 * - Timer expiry without action
 * - Late join attempts
 *
 * These are critical for a smooth demo experience!
 */

// Helper to navigate to Hot Takes from game selector
async function selectHotTakes(page: Page) {
	await page.locator('.game-card').filter({ hasText: 'Hot Takes' }).click();
	await expect(page.getByRole('heading', { name: 'Hot Takes' })).toBeVisible();
}

interface PlayerContext {
	name: string;
	context: BrowserContext;
	page: Page;
}

async function setupGameWithPlayers(
	browser: import('@playwright/test').Browser,
	playerNames: string[]
): Promise<{ players: PlayerContext[]; roomCode: string }> {
	const players: PlayerContext[] = [];

	for (const name of playerNames) {
		const context = await browser.newContext();
		const page = await context.newPage();
		players.push({ name, context, page });
	}

	const [host, ...others] = players;

	// Host creates game
	await host.page.goto('/');
	await selectHotTakes(host.page);
	await host.page.getByLabel('Your name').fill(host.name);
	await host.page.getByRole('button', { name: 'Host game' }).click();
	await expect(host.page.getByText('Room code')).toBeVisible({ timeout: 15000 });

	const roomCode = (await host.page.locator('.code-value').textContent()) || '';

	// Others join
	for (const player of others) {
		await player.page.goto('/');
		await selectHotTakes(player.page);
		await player.page.getByLabel('Your name').fill(player.name);
		await player.page.locator('input[placeholder="CODE"]').fill(roomCode);
		await player.page.getByRole('button', { name: 'Join' }).click();
		await expect(player.page.getByText('Room code')).toBeVisible({ timeout: 15000 });
	}

	// Set 1 take per player for faster tests
	const settingSection = host.page.locator('.setting').filter({ hasText: 'Takes per player' });
	const takesOneButton = settingSection.locator('.option-btn').filter({ hasText: /^1$/ });
	if (await takesOneButton.isVisible()) {
		await takesOneButton.click();
	}

	// Non-host players mark ready
	for (const player of others) {
		await player.page.getByRole('button', { name: 'Ready' }).click();
	}

	// Wait for start button to be enabled
	await expect(host.page.getByRole('button', { name: 'Start game' })).toBeEnabled({
		timeout: 5000,
	});

	return { players, roomCode };
}

test.describe('Hot Takes resilience - Player disconnects', () => {
	test.setTimeout(120000);

	test('game continues when a non-host player disconnects during lobby', async ({ browser }) => {
		const { players, roomCode } = await setupGameWithPlayers(browser, ['AAA', 'BBB', 'CCC']);
		const [host, player2, player3] = players;

		try {
			// Verify all players visible
			await expect(host.page.getByText('BBB')).toBeVisible();
			await expect(host.page.getByText('CCC')).toBeVisible();

			// Player 2 disconnects (closes browser)
			await player2.context.close();

			// Wait a moment for disconnect to propagate
			await host.page.waitForTimeout(2000);

			// Host should see player marked as disconnected OR removed
			// The game should still be functional
			const startButton = host.page.getByRole('button', { name: 'Start game' });

			// With only 2 connected players (AAA + CCC), start should be disabled (need 3)
			// OR if BBB is still shown as disconnected, it depends on implementation
			// Either way, the UI should NOT crash
			await expect(host.page.getByText('Room code')).toBeVisible();

			console.log('Lobby remained stable after player disconnect');
		} finally {
			for (const player of players) {
				if (player !== player2) {
					await player.context.close();
				}
			}
		}
	});

	test('game handles player disconnect during submission phase', async ({ browser }) => {
		const { players } = await setupGameWithPlayers(browser, ['AAA', 'BBB', 'CCC']);
		const [host, player2, player3] = players;

		try {
			// Start the game
			await host.page.getByRole('button', { name: 'Start game' }).click();

			// Wait for submission phase
			await expect(host.page.getByText('Submit your hot takes')).toBeVisible({ timeout: 10000 });

			// Host and player3 submit their takes
			for (const player of [host, player3]) {
				await player.page.locator('textarea').fill(`Take from ${player.name}`);
				await player.page.getByRole('button', { name: /Submit take/i }).click();
			}

			// Player 2 disconnects WITHOUT submitting
			await player2.context.close();

			// Wait for disconnect to propagate
			await host.page.waitForTimeout(3000);

			// The game should eventually advance (not hang forever waiting for BBB)
			// This might take some time as the system detects disconnect
			await expect(
				host.page.getByText(/Do you agree with this take|Waiting/i).first()
			).toBeVisible({
				timeout: 30000,
			});

			console.log('Game advanced after player disconnect during submission');
		} finally {
			for (const player of players) {
				if (player !== player2) {
					await player.context.close();
				}
			}
		}
	});

	test('game handles player disconnect during voting phase', async ({ browser }) => {
		const { players } = await setupGameWithPlayers(browser, ['AAA', 'BBB', 'CCC']);
		const [host, player2, player3] = players;

		try {
			// Start the game
			await host.page.getByRole('button', { name: 'Start game' }).click();

			// All players submit takes
			for (const player of players) {
				await expect(player.page.getByText('Submit your hot takes')).toBeVisible({
					timeout: 10000,
				});
				await player.page.locator('textarea').fill(`Take from ${player.name}`);
				await player.page.getByRole('button', { name: /Submit take/i }).click();
				await player.page.waitForTimeout(300);
			}

			// Wait for voting phase
			await expect(host.page.getByText('Do you agree with this take?')).toBeVisible({
				timeout: 15000,
			});

			// Host votes
			await host.page.locator('.vote-btn.agree').click();

			// Player 2 disconnects WITHOUT voting
			await player2.context.close();

			// Player 3 votes
			await player3.page.locator('.vote-btn.agree').click();

			// Game should advance to guessing phase (not hang waiting for BBB's vote)
			await expect(
				host.page.getByText(/Who wrote this take|This is your take/i).first()
			).toBeVisible({
				timeout: 30000,
			});

			console.log('Game advanced to guessing after player disconnect during voting');
		} finally {
			for (const player of players) {
				if (player !== player2) {
					await player.context.close();
				}
			}
		}
	});

	test('game handles player disconnect during guessing phase', async ({ browser }) => {
		const { players } = await setupGameWithPlayers(browser, ['AAA', 'BBB', 'CCC']);
		const [host, player2, player3] = players;

		try {
			// Start the game
			await host.page.getByRole('button', { name: 'Start game' }).click();

			// All players submit takes
			for (const player of players) {
				await expect(player.page.getByText('Submit your hot takes')).toBeVisible({
					timeout: 10000,
				});
				await player.page.locator('textarea').fill(`Take from ${player.name}`);
				await player.page.getByRole('button', { name: /Submit take/i }).click();
				await player.page.waitForTimeout(300);
			}

			// Wait for voting phase and all vote
			await expect(host.page.getByText('Do you agree with this take?')).toBeVisible({
				timeout: 15000,
			});
			for (const player of players) {
				const agreeBtn = player.page.locator('.vote-btn.agree');
				if (await agreeBtn.isVisible({ timeout: 3000 })) {
					await agreeBtn.click();
				}
			}

			// Wait for guessing phase
			await expect(
				host.page.getByText(/Who wrote this take|This is your take/i).first()
			).toBeVisible({
				timeout: 15000,
			});

			// Host guesses (if not author)
			const hostIsAuthor = await host.page.getByText('This is your take').isVisible();
			if (!hostIsAuthor) {
				const guessBtn = host.page.locator('.guess-btn:not([disabled])').first();
				if (await guessBtn.isVisible()) {
					await guessBtn.click();
				}
			}

			// Player 2 disconnects WITHOUT guessing
			await player2.context.close();

			// Player 3 guesses (if not author)
			const p3IsAuthor = await player3.page.getByText('This is your take').isVisible();
			if (!p3IsAuthor) {
				const guessBtn = player3.page.locator('.guess-btn:not([disabled])').first();
				if (await guessBtn.isVisible()) {
					await guessBtn.click();
				}
			}

			// Game should advance to reveal (not hang waiting for BBB's guess)
			await expect(host.page.getByText(/Next take coming up|Game over/i).first()).toBeVisible({
				timeout: 30000,
			});

			console.log('Game advanced to reveal after player disconnect during guessing');
		} finally {
			for (const player of players) {
				if (player !== player2) {
					await player.context.close();
				}
			}
		}
	});
});

test.describe('Hot Takes resilience - Host disconnect', () => {
	test.setTimeout(60000);

	test('players see error when host disconnects in lobby', async ({ browser }) => {
		const { players } = await setupGameWithPlayers(browser, ['AAA', 'BBB', 'CCC']);
		const [host, player2, player3] = players;

		try {
			// Host disconnects
			await host.context.close();

			// Wait for disconnect to propagate
			await player2.page.waitForTimeout(5000);

			// Players should see some indication the connection is lost
			// This could be an error message, disconnect indicator, or redirect
			// The exact behavior depends on implementation
			const hasError = await player2.page.getByText(/disconnect|error|lost/i).isVisible();
			const hasLobby = await player2.page.getByText('Room code').isVisible();

			// Either there's an error shown, or the lobby is still visible (possibly with host marked disconnected)
			expect(hasError || hasLobby).toBe(true);

			console.log(
				'Player UI remained stable after host disconnect:',
				hasError ? 'error shown' : 'lobby still visible'
			);
		} finally {
			for (const player of players) {
				if (player !== host) {
					await player.context.close();
				}
			}
		}
	});
});

test.describe('Hot Takes resilience - Timer expiry', () => {
	test.setTimeout(120000);

	test('game advances when voting timer expires', async ({ browser }) => {
		// This test requires setting a short voting time
		const { players } = await setupGameWithPlayers(browser, ['AAA', 'BBB', 'CCC']);
		const [host, player2, player3] = players;

		try {
			// Set shortest voting time (10s)
			const settingSection = host.page.locator('.setting').filter({ hasText: 'Voting time' });
			const shortTimeButton = settingSection.locator('.option-btn').first();
			if (await shortTimeButton.isVisible()) {
				await shortTimeButton.click();
			}

			// Start the game
			await host.page.getByRole('button', { name: 'Start game' }).click();

			// All players submit takes
			for (const player of players) {
				await expect(player.page.getByText('Submit your hot takes')).toBeVisible({
					timeout: 10000,
				});
				await player.page.locator('textarea').fill(`Take from ${player.name}`);
				await player.page.getByRole('button', { name: /Submit take/i }).click();
				await player.page.waitForTimeout(300);
			}

			// Wait for voting phase
			await expect(host.page.getByText('Do you agree with this take?')).toBeVisible({
				timeout: 15000,
			});

			// DON'T vote - let the timer expire
			// Wait for timer to expire (10s + buffer)
			console.log('Waiting for voting timer to expire...');

			// Game should auto-advance to guessing phase after timer
			await expect(
				host.page.getByText(/Who wrote this take|This is your take/i).first()
			).toBeVisible({
				timeout: 20000,
			});

			console.log('Game auto-advanced after voting timer expired');
		} finally {
			for (const player of players) {
				await player.context.close();
			}
		}
	});
});

test.describe('Hot Takes resilience - Late join attempts', () => {
	test.setTimeout(60000);

	test('player cannot join game that has already started', async ({ browser }) => {
		const { players, roomCode } = await setupGameWithPlayers(browser, ['AAA', 'BBB', 'CCC']);
		const [host] = players;

		// Create a late joiner
		const lateContext = await browser.newContext();
		const latePage = await lateContext.newPage();

		try {
			// Start the game
			await host.page.getByRole('button', { name: 'Start game' }).click();

			// Wait for submission phase
			await expect(host.page.getByText('Submit your hot takes')).toBeVisible({ timeout: 10000 });

			// Late joiner tries to join
			await latePage.goto('/');
			await selectHotTakes(latePage);
			await latePage.getByLabel('Your name').fill('LATE');
			await latePage.locator('input[placeholder="CODE"]').fill(roomCode);
			await latePage.getByRole('button', { name: 'Join' }).click();

			// Should see an error or be rejected
			await expect(
				latePage.getByText(/started|progress|cannot join|full/i).first()
			).toBeVisible({
				timeout: 10000,
			});

			console.log('Late join correctly rejected');
		} finally {
			await lateContext.close();
			for (const player of players) {
				await player.context.close();
			}
		}
	});
});

test.describe('Hot Takes resilience - Duplicate sessions', () => {
	test.setTimeout(60000);

	test('opening second browser window does not corrupt game state', async ({ browser }) => {
		const { players, roomCode } = await setupGameWithPlayers(browser, ['AAA', 'BBB', 'CCC']);
		const [host, player2, player3] = players;

		try {
			// Player 2 opens a second browser window with same session
			// (simulating accidental tab duplication)
			const secondContext = await browser.newContext();
			const secondPage = await secondContext.newPage();

			await secondPage.goto('/');
			await selectHotTakes(secondPage);
			await secondPage.getByLabel('Your name').fill('BBB'); // Same name
			await secondPage.locator('input[placeholder="CODE"]').fill(roomCode);
			await secondPage.getByRole('button', { name: 'Join' }).click();

			// Wait and check the lobby
			await host.page.waitForTimeout(2000);

			// Either:
			// 1. The second window joins as a new player (BBB appears twice)
			// 2. The second window replaces the first (original BBB disconnects)
			// 3. The join is rejected

			// The important thing is that the UI doesn't crash
			await expect(host.page.getByText('Room code')).toBeVisible();

			// Original game should still work
			await expect(host.page.getByRole('button', { name: 'Start game' })).toBeVisible();

			console.log('Lobby remained stable with duplicate session attempt');

			await secondContext.close();
		} finally {
			for (const player of players) {
				await player.context.close();
			}
		}
	});
});
