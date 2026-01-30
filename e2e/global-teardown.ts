/**
 * Playwright global teardown - stops all WebSocket bridge servers.
 */

import { stopBridgeServer } from './ws-bridge-server';

const BASE_PORT = 9876;
const NUM_WORKERS = 2; // Must match workers in playwright.config.ts

export default async function globalTeardown() {
	console.log('[Global Teardown] Stopping WebSocket bridge servers...');

	// Stop all bridge servers
	const stopPromises = [];
	for (let i = 0; i < NUM_WORKERS; i++) {
		const port = BASE_PORT + i;
		stopPromises.push(stopBridgeServer(port));
	}

	await Promise.all(stopPromises);
	console.log('[Global Teardown] All WebSocket bridge servers stopped');
}
