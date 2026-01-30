/**
 * Playwright global setup - starts WebSocket bridge servers for parallel multi-browser tests.
 * Each worker gets its own bridge server on a unique port.
 */

import { startBridgeServer } from './ws-bridge-server';

const BASE_PORT = 9876;
const NUM_WORKERS = 2; // Must match workers in playwright.config.ts

export default async function globalSetup() {
	console.log(`[Global Setup] Starting ${NUM_WORKERS} WebSocket bridge servers...`);

	// Start a bridge server for each worker
	const startPromises = [];
	for (let i = 0; i < NUM_WORKERS; i++) {
		const port = BASE_PORT + i;
		startPromises.push(startBridgeServer(port));
	}

	await Promise.all(startPromises);
	console.log('[Global Setup] All WebSocket bridge servers started');
}
