import { test, expect } from '@playwright/test';
import { injectTestConfigToContext } from './test-helpers';

// Helper to navigate to Photo Roulette from game selector
async function selectPhotoRoulette(page: import('@playwright/test').Page) {
	await page.goto('/');
	await page.locator('.game-card').filter({ hasText: 'Photo Roulette' }).click();
	await expect(page.getByRole('heading', { name: 'Photo Roulette' })).toBeVisible();
}

test.describe('Photo Roulette host game flow', () => {
	test('can create a game and enter lobby', async ({ page }) => {
		await injectTestConfigToContext(page.context());
		await selectPhotoRoulette(page);

		// Navigate to host form
		await page.getByRole('button', { name: 'Host a game' }).click();

		// Wait for form to appear
		await expect(page.getByRole('heading', { name: 'Host a game' })).toBeVisible();

		// Fill in name
		await page.getByLabel('Your name').fill('Test Host');

		// Select an emoji (click the first one)
		await page.locator('.emoji-button').first().click();

		// Create the game
		await page.getByRole('button', { name: 'Create game' }).click();

		// Should show connecting state briefly, then lobby
		await expect(page.getByText('Room code')).toBeVisible({ timeout: 10000 });

		// Room code should be displayed (4 characters)
		const roomCodeElement = page.locator('.code');
		await expect(roomCodeElement).toBeVisible();
		const roomCode = await roomCodeElement.textContent();
		expect(roomCode).toMatch(/^[A-Z0-9]{4}$/);

		// Host player should be in the list
		await expect(page.getByText('Test Host')).toBeVisible();

		// Settings should be visible
		await expect(page.getByText(/\d+ rounds • \d+s/)).toBeVisible();

		// Connect photos button should be visible
		await expect(page.getByRole('button', { name: /Connect your photos/ })).toBeVisible();

		// Start game button should be visible (disabled, showing need for more players)
		await expect(page.getByRole('button', { name: /Need .* more player/ })).toBeVisible();
	});

	test('can copy room code', async ({ page }) => {
		await injectTestConfigToContext(page.context());
		await selectPhotoRoulette(page);

		// Create a game
		await page.getByRole('button', { name: 'Host a game' }).click();
		await expect(page.getByRole('heading', { name: 'Host a game' })).toBeVisible();
		await page.getByLabel('Your name').fill('Test Host');
		await page.getByRole('button', { name: 'Create game' }).click();

		// Wait for lobby
		await expect(page.getByText('Room code')).toBeVisible({ timeout: 10000 });

		// Click the copy button
		await page.locator('.room-code').click();

		// Should show checkmark (copied indicator)
		await expect(page.locator('.copy-icon')).toContainText('✓');
	});

	test('host is shown in player list with host badge', async ({ page }) => {
		await injectTestConfigToContext(page.context());
		await selectPhotoRoulette(page);

		// Create a game
		await page.getByRole('button', { name: 'Host a game' }).click();
		await expect(page.getByRole('heading', { name: 'Host a game' })).toBeVisible();
		await page.getByLabel('Your name').fill('Host Player');
		await page.getByRole('button', { name: 'Create game' }).click();

		// Wait for lobby
		await expect(page.getByText('Room code')).toBeVisible({ timeout: 10000 });

		// Host should be in the player list
		await expect(page.locator('.player-card').first()).toContainText('Host Player');

		// Should show host badge (star icon)
		await expect(page.locator('.host-badge')).toBeVisible();
	});

	test('can leave the game from lobby', async ({ page }) => {
		await injectTestConfigToContext(page.context());
		await selectPhotoRoulette(page);

		// Create a game
		await page.getByRole('button', { name: 'Host a game' }).click();
		await expect(page.getByRole('heading', { name: 'Host a game' })).toBeVisible();
		await page.getByLabel('Your name').fill('Test Host');
		await page.getByRole('button', { name: 'Create game' }).click();

		// Wait for lobby
		await expect(page.getByText('Room code')).toBeVisible({ timeout: 10000 });

		// Leave the game
		await page.getByRole('button', { name: 'Leave game' }).click();

		// Should be back on landing page
		await expect(page.getByRole('button', { name: 'Host a game' })).toBeVisible();
	});

	test('can change game settings', async ({ page }) => {
		await injectTestConfigToContext(page.context());
		await selectPhotoRoulette(page);

		// Create a game
		await page.getByRole('button', { name: 'Host a game' }).click();
		await expect(page.getByRole('heading', { name: 'Host a game' })).toBeVisible();
		await page.getByLabel('Your name').fill('Test Host');
		await page.getByRole('button', { name: 'Create game' }).click();

		// Wait for lobby
		await expect(page.getByText('Room code')).toBeVisible({ timeout: 10000 });

		// Click settings chip to expand settings
		await page.locator('.settings-chip').click();

		// Should show settings panel
		await expect(page.getByLabel('Rounds')).toBeVisible();
		await expect(page.getByLabel('Timer (seconds)')).toBeVisible();

		// Change rounds to 16
		await page.getByLabel('Rounds').selectOption('16');

		// Settings should update
		await expect(page.getByText(/16 rounds/)).toBeVisible();
	});
});
