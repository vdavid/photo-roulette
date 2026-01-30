import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { injectTestConfigToContext } from './test-helpers';

const BASE_WS_PORT = 9876;

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

test.describe('Hot Takes landing page', () => {
	test('shows welcome screen with host and join options', async ({ page }, testInfo) => {
		// Inject config to context, not page - works better with Playwright fixtures
		await injectTestConfigToContext(page.context(), testInfo.parallelIndex);
		await page.goto('/');
		await selectHotTakes(page);

		// Check header elements
		await expect(page.getByRole('heading', { name: 'Hot Takes' })).toBeVisible();
		await expect(page.getByText(/spiciest opinions/i)).toBeVisible();

		// Check host button (Hot Takes uses "Host game" not "Host a game")
		await expect(page.getByRole('button', { name: 'Host game' })).toBeVisible();

		// Check join section (name input and join button on same page)
		await expect(page.getByLabel('Your name')).toBeVisible();
	});

	test('can create a game from landing page', async ({ page }, testInfo) => {
		await injectTestConfigToContext(page.context(), testInfo.parallelIndex);
		await page.goto('/');
		await selectHotTakes(page);

		// Fill in name on landing page
		await page.getByLabel('Your name').fill('Test Host');

		// Click Host game
		await page.getByRole('button', { name: 'Host game' }).click();

		// Should go to lobby
		await expect(page.getByText('Room code')).toBeVisible({ timeout: 10000 });

		// Room code should be displayed
		const roomCodeElement = page.locator('.code-value');
		await expect(roomCodeElement).toBeVisible();
		const roomCode = await roomCodeElement.textContent();
		expect(roomCode).toMatch(/^[A-Z0-9]{4}$/);

		// Host player should be in the list
		await expect(page.getByText('Test Host')).toBeVisible();
	});
});

test.describe('Hot Takes lobby', () => {
	test('can create a game and enter lobby', async ({ page }, testInfo) => {
		await injectTestConfigToContext(page.context(), testInfo.parallelIndex);
		await page.goto('/');
		await selectHotTakes(page);

		// Fill in name
		await page.getByLabel('Your name').fill('Test Host');

		// Create the game
		await page.getByRole('button', { name: 'Host game' }).click();

		// Should show lobby with room code
		await expect(page.getByText('Room code')).toBeVisible({ timeout: 10000 });

		// Room code should be displayed (4 characters)
		const roomCodeElement = page.locator('.code-value');
		await expect(roomCodeElement).toBeVisible();
		const roomCode = await roomCodeElement.textContent();
		expect(roomCode).toMatch(/^[A-Z0-9]{4}$/);

		// Host player should be in the list
		await expect(page.getByText('Test Host')).toBeVisible();

		// Settings should be visible (takes per player shown as "Takes per player")
		await expect(page.getByText(/Takes per player/i)).toBeVisible();

		// Need more players message should be visible
		await expect(page.getByText(/Need at least \d+ players/i)).toBeVisible();

		// Start game button should be visible but disabled
		const startButton = page.getByRole('button', { name: 'Start game' });
		await expect(startButton).toBeVisible();
		await expect(startButton).toBeDisabled();
	});

	test('can leave the game from lobby', async ({ page }, testInfo) => {
		await injectTestConfigToContext(page.context(), testInfo.parallelIndex);
		await page.goto('/');
		await selectHotTakes(page);

		// Create a game
		await page.getByLabel('Your name').fill('Test Host');
		await page.getByRole('button', { name: 'Host game' }).click();

		// Wait for lobby
		await expect(page.getByText('Room code')).toBeVisible({ timeout: 10000 });

		// Leave the game
		await page.getByRole('button', { name: 'Leave game' }).click();

		// Should be back on Hot Takes landing page
		await expect(page.getByRole('button', { name: 'Host game' })).toBeVisible();
	});
});

test.describe('Hot Takes multiplayer lobby', () => {
	// All tests now use WebSocket bridge mock - no skip needed

	// Use serial to prevent parallel execution of steps in this describe block
	test.describe.configure({ mode: 'serial' });

	let players: PlayerContext[] = [];
	let roomCode: string;

	test.beforeAll(async ({ browser }, testInfo) => {
		// Create 3 browser contexts for 3 players
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
	});

	test.afterAll(async () => {
		for (const player of players) {
			await player.context.close();
		}
	});

	test('multiple players can join a lobby', async () => {
		const [host, player2, player3] = players;

		// Host creates game
		await test.step('Host creates game', async () => {
			await host.page.goto('/');
			await selectHotTakes(host.page);
			await host.page.getByLabel('Your name').fill(host.name);
			await host.page.getByRole('button', { name: 'Host game' }).click();

			// Wait for lobby and get room code
			await expect(host.page.getByText('Room code')).toBeVisible({ timeout: 10000 });
			const roomCodeElement = host.page.locator('.code-value');
			roomCode = (await roomCodeElement.textContent()) || '';
			expect(roomCode).toMatch(/^[A-Z0-9]{4}$/);
		});

		// Other players join
		await test.step('Other players join', async () => {
			for (const player of [player2, player3]) {
				await player.page.goto('/');
				await selectHotTakes(player.page);
				// Fill in name and room code on landing page
				await player.page.getByLabel('Your name').fill(player.name);
				await player.page.locator('input[placeholder="CODE"]').fill(roomCode);
				await player.page.getByRole('button', { name: 'Join' }).click();

				// Wait for lobby
				await expect(player.page.getByText('Room code')).toBeVisible({ timeout: 10000 });
			}

			// Verify all players are visible in host's lobby
			for (const player of players) {
				await expect(host.page.getByText(player.name)).toBeVisible();
			}
		});

		// Non-host players mark themselves as ready
		await test.step('Players mark themselves as ready', async () => {
			for (const player of [player2, player3]) {
				await player.page.getByRole('button', { name: 'Ready' }).click();
				// Wait for ready status to appear
				await expect(player.page.getByText('Ready').first()).toBeVisible();
			}
		});

		// Verify start button is now enabled (3 players minimum and all ready)
		await test.step('Start button is enabled with 3 ready players', async () => {
			await expect(host.page.getByRole('button', { name: 'Start game' })).toBeEnabled({
				timeout: 5000,
			});
		});

		// Non-host cannot start game
		await test.step('Non-host sees waiting message', async () => {
			await expect(player2.page.getByText(/Waiting for host/i)).toBeVisible();
		});
	});
});
