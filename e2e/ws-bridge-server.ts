/**
 * WebSocket bridge server for PeerJS mock.
 * Routes messages between browser contexts for multi-browser E2E tests.
 */

import { WebSocketServer, WebSocket } from 'ws';

interface PeerConnection {
	ws: WebSocket;
	peerId: string;
}

// Track server instances by port (supports multiple workers in same process for testing)
const servers = new Map<number, { wss: WebSocketServer; peers: Map<string, PeerConnection> }>();

export function startBridgeServer(port: number = 9876): Promise<void> {
	return new Promise((resolve, reject) => {
		if (servers.has(port)) {
			resolve();
			return;
		}

		const peers = new Map<string, PeerConnection>();
		const wss = new WebSocketServer({ port });

		wss.on('listening', () => {
			servers.set(port, { wss, peers });
			console.log(`[WS Bridge] Server listening on port ${port}`);
			resolve();
		});

		wss.on('error', (err) => {
			console.error(`[WS Bridge] Server error on port ${port}:`, err);
			reject(err);
		});

		wss.on('connection', (ws) => {
			let peerId: string | null = null;

			ws.on('message', (data) => {
				try {
					const msg = JSON.parse(data.toString());

					switch (msg.type) {
						case 'register':
							// Register this peer
							peerId = msg.peerId;
							peers.set(peerId, { ws, peerId });
							console.log(`[WS Bridge] Peer registered: ${peerId}`);
							ws.send(JSON.stringify({ type: 'registered', peerId }));
							break;

						case 'connect':
							// One peer wants to connect to another
							const targetPeer = peers.get(msg.targetPeerId);
							if (targetPeer) {
								// Notify target of incoming connection
								targetPeer.ws.send(
									JSON.stringify({
										type: 'incoming-connection',
										fromPeerId: peerId,
									})
								);
								// Notify initiator that target exists
								ws.send(
									JSON.stringify({
										type: 'connection-ready',
										targetPeerId: msg.targetPeerId,
									})
								);
							} else {
								// Queue this connection request - target may not exist yet
								ws.send(
									JSON.stringify({
										type: 'connection-pending',
										targetPeerId: msg.targetPeerId,
									})
								);
							}
							break;

						case 'data':
							// Route data to target peer
							const target = peers.get(msg.targetPeerId);
							if (target) {
								target.ws.send(
									JSON.stringify({
										type: 'data',
										fromPeerId: peerId,
										data: msg.data,
									})
								);
							}
							break;

						case 'check-peer':
							// Check if a peer exists (for pending connections)
							const exists = peers.has(msg.targetPeerId);
							ws.send(
								JSON.stringify({
									type: 'peer-status',
									targetPeerId: msg.targetPeerId,
									exists,
								})
							);
							break;
					}
				} catch (err) {
					console.error('[WS Bridge] Message parse error:', err);
				}
			});

			ws.on('close', () => {
				if (peerId) {
					console.log(`[WS Bridge] Peer disconnected: ${peerId}`);
					peers.delete(peerId);
					// Notify all other peers about this disconnect
					for (const [, peer] of peers) {
						peer.ws.send(
							JSON.stringify({
								type: 'peer-disconnected',
								peerId,
							})
						);
					}
				}
			});

			ws.on('error', (err) => {
				console.error(`[WS Bridge] WebSocket error for peer ${peerId}:`, err);
			});
		});
	});
}

export function stopBridgeServer(port: number = 9876): Promise<void> {
	return new Promise((resolve) => {
		const server = servers.get(port);
		if (!server) {
			resolve();
			return;
		}

		// Close all connections
		for (const [, peer] of server.peers) {
			peer.ws.close();
		}
		server.peers.clear();

		server.wss.close(() => {
			console.log(`[WS Bridge] Server stopped on port ${port}`);
			servers.delete(port);
			resolve();
		});
	});
}

export function getBridgeUrl(port: number = 9876): string {
	return `ws://localhost:${port}`;
}
