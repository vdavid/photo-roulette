import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	// Global setup/teardown for WebSocket bridge servers (one per worker)
	globalSetup: './e2e/global-setup.ts',
	globalTeardown: './e2e/global-teardown.ts',
	// Enable parallel execution - each worker gets its own WebSocket bridge
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// Use 2 workers for parallelization (more stable with WebSocket bridges)
	workers: 2,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			// Exclude resilience tests from parallel execution
			testIgnore: /resilience\.spec\.ts/,
		},
		{
			name: 'chromium-resilience',
			use: { ...devices['Desktop Chrome'] },
			// Run resilience tests serially after main tests
			testMatch: /resilience\.spec\.ts/,
			dependencies: ['chromium'],
		},
	],
	webServer: {
		command: 'pnpm dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 30000,
	},
});
