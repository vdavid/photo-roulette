import { test, expect } from '@playwright/test';

// Helper to navigate to Photo Roulette from game selector
async function selectPhotoRoulette(page: import('@playwright/test').Page) {
	await page.goto('/');
	await page.locator('.game-card').filter({ hasText: 'Photo Roulette' }).click();
	await expect(page.getByRole('heading', { name: 'Photo Roulette' })).toBeVisible();
}

test.describe('Photo Roulette landing page', () => {
	test('shows welcome screen with host and join buttons', async ({ page }) => {
		await selectPhotoRoulette(page);

		// Check header elements (use getByRole to avoid strict mode violations)
		await expect(page.getByRole('heading', { name: 'Photo Roulette' })).toBeVisible();
		await expect(page.getByText('Guess whose photo it is!')).toBeVisible();

		// Check buttons
		await expect(page.getByRole('button', { name: 'Host a game' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Join a game' })).toBeVisible();
	});

	test('can navigate to host game form', async ({ page }) => {
		await selectPhotoRoulette(page);

		await page.getByRole('button', { name: 'Host a game' }).click();

		// Wait for the form heading (h2) to confirm navigation
		await expect(page.getByRole('heading', { name: 'Host a game' })).toBeVisible();

		// Should show host form
		await expect(page.getByLabel('Your name')).toBeVisible();
		await expect(page.getByText('Pick your emoji')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Create game' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
	});

	test('can navigate to join game form', async ({ page }) => {
		await selectPhotoRoulette(page);

		await page.getByRole('button', { name: 'Join a game' }).click();

		// Should show join form
		await expect(page.getByText('Join a game')).toBeVisible();
		await expect(page.getByLabel('Room code')).toBeVisible();
		await expect(page.getByLabel('Your name')).toBeVisible();
		await expect(page.getByText('Pick your emoji')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Join game' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
	});

	test('can go back from host form to landing', async ({ page }) => {
		await selectPhotoRoulette(page);

		await page.getByRole('button', { name: 'Host a game' }).click();
		// Wait for form heading (h2)
		await expect(page.getByRole('heading', { name: 'Host a game' })).toBeVisible();

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page.getByRole('button', { name: 'Host a game' })).toBeVisible();
	});

	test('can go back from join form to landing', async ({ page }) => {
		await selectPhotoRoulette(page);

		await page.getByRole('button', { name: 'Join a game' }).click();
		// Wait for form heading (h2)
		await expect(page.getByRole('heading', { name: 'Join a game' })).toBeVisible();

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page.getByRole('button', { name: 'Join a game' })).toBeVisible();
	});

	test('shows validation error when trying to host without name', async ({ page }) => {
		await selectPhotoRoulette(page);

		await page.getByRole('button', { name: 'Host a game' }).click();
		// Wait for form heading (h2)
		await expect(page.getByRole('heading', { name: 'Host a game' })).toBeVisible();

		// The name field should be empty initially, just try to create
		await page.getByRole('button', { name: 'Create game' }).click();

		await expect(page.getByText('Please enter your name')).toBeVisible();
	});

	test('shows validation error when trying to join without name or code', async ({ page }) => {
		await selectPhotoRoulette(page);

		await page.getByRole('button', { name: 'Join a game' }).click();
		// Wait for form heading (h2)
		await expect(page.getByRole('heading', { name: 'Join a game' })).toBeVisible();

		// Try to join without entering anything
		await page.getByRole('button', { name: 'Join game' }).click();
		await expect(page.getByText('Please enter your name')).toBeVisible();

		// Enter name but no code
		await page.getByLabel('Your name').fill('Test Player');
		await page.getByRole('button', { name: 'Join game' }).click();
		await expect(page.getByText('Please enter a room code')).toBeVisible();
	});
});
