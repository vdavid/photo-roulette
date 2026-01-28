import { test, expect } from '@playwright/test';

test.describe('Game selector', () => {
	test('shows game selector with all games', async ({ page }) => {
		await page.goto('/');

		// Check header
		await expect(page.getByRole('heading', { name: 'Party games' })).toBeVisible();
		await expect(page.getByText('Pick a game to play with friends')).toBeVisible();

		// Check Photo Roulette card
		await expect(page.getByRole('heading', { name: 'Photo Roulette' })).toBeVisible();
		await expect(page.getByText(/Connect your photos/)).toBeVisible();
		await expect(page.getByText('2-8 players').first()).toBeVisible();

		// Check Hot Takes card
		await expect(page.getByRole('heading', { name: 'Hot Takes' })).toBeVisible();
		await expect(page.getByText(/controversial opinions/i)).toBeVisible();
		await expect(page.getByText('3-8 players')).toBeVisible();
	});

	test('can select Photo Roulette', async ({ page }) => {
		await page.goto('/');

		// Click Photo Roulette card
		await page.locator('.game-card').filter({ hasText: 'Photo Roulette' }).click();

		// Should show Photo Roulette landing page
		await expect(page.getByRole('heading', { name: 'Photo Roulette' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Host a game' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Join a game' })).toBeVisible();

		// URL should have game parameter
		await expect(page).toHaveURL(/\?game=photo-roulette/);
	});

	test('can select Hot Takes', async ({ page }) => {
		await page.goto('/');

		// Click Hot Takes card
		await page.locator('.game-card').filter({ hasText: 'Hot Takes' }).click();

		// Should show Hot Takes landing page
		await expect(page.getByRole('heading', { name: 'Hot Takes' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Host game' })).toBeVisible();

		// URL should have game parameter
		await expect(page).toHaveURL(/\?game=hot-takes/);
	});

	test('can navigate directly via URL to Photo Roulette', async ({ page }) => {
		await page.goto('/?game=photo-roulette');

		// Should show Photo Roulette landing directly
		await expect(page.getByRole('heading', { name: 'Photo Roulette' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Host a game' })).toBeVisible();
	});

	test('can navigate directly via URL to Hot Takes', async ({ page }) => {
		await page.goto('/?game=hot-takes');

		// Should show Hot Takes landing directly
		await expect(page.getByRole('heading', { name: 'Hot Takes' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Host game' })).toBeVisible();
	});

	test('can go back to game selector from Photo Roulette', async ({ page }) => {
		await page.goto('/?game=photo-roulette');

		// Should show Photo Roulette landing
		await expect(page.getByRole('button', { name: 'Host a game' })).toBeVisible();

		// Click back to menu (text is "All games")
		await page.getByRole('button', { name: 'All games' }).click();

		// Should show game selector
		await expect(page.getByRole('heading', { name: 'Party games' })).toBeVisible();

		// URL should be clean
		await expect(page).toHaveURL('/');
	});

	test('can go back to game selector from Hot Takes', async ({ page }) => {
		await page.goto('/?game=hot-takes');

		// Should show Hot Takes landing
		await expect(page.getByRole('button', { name: 'Host game' })).toBeVisible();

		// Click back to menu (text is "All games")
		await page.getByRole('button', { name: 'All games' }).click();

		// Should show game selector
		await expect(page.getByRole('heading', { name: 'Party games' })).toBeVisible();

		// URL should be clean
		await expect(page).toHaveURL('/');
	});

	test('invalid game parameter shows game selector', async ({ page }) => {
		await page.goto('/?game=invalid-game');

		// Should show game selector (invalid game ID ignored)
		await expect(page.getByRole('heading', { name: 'Party games' })).toBeVisible();
	});
});
