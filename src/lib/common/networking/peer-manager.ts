/**
 * PeerJS wrapper for managing peer connections
 * Shared across all games
 */

import Peer, { type DataConnection } from 'peerjs';
import type { PlayerId, BaseMessage, ConnectionState, PeerConnection } from './types.js';
import {
	PEERJS_CONFIG,
	CONNECTION_TIMEOUT_MS,
	PING_INTERVAL_MS,
	PING_TIMEOUT_MS,
	MAX_MISSED_PINGS,
} from './constants.js';
import { roomCodeToPeerId } from './room-code.js';
import { getLogger } from '$lib/common/logging.js';

const logger = getLogger(['networking', 'peer-manager']);

/** Events emitted by PeerManager */
export interface PeerManagerEvents {
	/** Peer is ready and connected to signaling server */
	open: (peerId: string) => void;
	/** Connection to signaling server closed */
	close: () => void;
	/** Error occurred */
	error: (error: Error) => void;
	/** New peer connected (for host) */
	connection: (peerId: string, connection: DataConnection) => void;
	/** Peer disconnected */
	disconnection: (peerId: string) => void;
	/** Message received from a peer */
	message: (peerId: string, message: BaseMessage) => void;
}

type EventCallback<K extends keyof PeerManagerEvents> = PeerManagerEvents[K];

/**
 * Manages PeerJS peer lifecycle and connections
 */
export class PeerManager {
	private peer: Peer | null = null;
	private connections: Map<string, DataConnection> = new Map();
	private peerStates: Map<string, PeerConnection> = new Map();
	private pingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
	private reconnectAttempts: Map<string, number> = new Map();
	private missedPings: Map<string, number> = new Map();
	private eventListeners: Map<
		keyof PeerManagerEvents,
		Set<EventCallback<keyof PeerManagerEvents>>
	> = new Map();

	private myPeerId: string | null = null;
	private isHost = false;

	/** Get current peer ID */
	get peerId(): string | null {
		return this.myPeerId;
	}

	/** Check if peer is open and connected to signaling server */
	get isOpen(): boolean {
		return this.peer !== null && !this.peer.destroyed;
	}

	/** Get all active connections */
	get activeConnections(): PeerConnection[] {
		return Array.from(this.peerStates.values());
	}

	/**
	 * Initialize as a host with a specific room code
	 */
	async initAsHost(roomCode: string): Promise<string> {
		const peerId = roomCodeToPeerId(roomCode);
		this.isHost = true;
		return this.initPeer(peerId);
	}

	/**
	 * Initialize as a player (generates random peer ID)
	 */
	async initAsPlayer(): Promise<string> {
		this.isHost = false;
		// Let PeerJS generate a random ID
		return this.initPeer();
	}

	/**
	 * Connect to a host's room
	 */
	async connectToHost(roomCode: string): Promise<DataConnection> {
		if (!this.peer) {
			throw new Error('Peer not initialized. Call initAsPlayer() first.');
		}

		const hostPeerId = roomCodeToPeerId(roomCode);

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Connection timeout'));
			}, CONNECTION_TIMEOUT_MS);

			const conn = this.peer!.connect(hostPeerId, {
				reliable: true,
			});

			conn.on('open', () => {
				clearTimeout(timeout);
				this.handleConnectionOpen(conn);
				resolve(conn);
			});

			conn.on('error', (err) => {
				clearTimeout(timeout);
				reject(err);
			});
		});
	}

	/**
	 * Send a message to a specific peer
	 */
	send(peerId: string, message: BaseMessage): boolean {
		const conn = this.connections.get(peerId);
		if (!conn || !conn.open) {
			logger.warn`Cannot send to ${peerId}: connection not open`;
			return false;
		}

		try {
			conn.send(message);
			return true;
		} catch (error) {
			logger.error`Error sending to ${peerId}: ${error}`;
			return false;
		}
	}

	/**
	 * Broadcast a message to all connected peers
	 */
	broadcast(message: BaseMessage): void {
		for (const [peerId, conn] of this.connections) {
			if (conn.open) {
				try {
					conn.send(message);
				} catch (error) {
					logger.error`Error broadcasting to ${peerId}: ${error}`;
				}
			}
		}
	}

	/**
	 * Disconnect a specific peer (host only)
	 */
	disconnectPeer(peerId: string): void {
		const conn = this.connections.get(peerId);
		if (conn) {
			conn.close();
			this.handleConnectionClose(peerId);
		}
	}

	/**
	 * Close all connections and destroy peer
	 */
	destroy(): void {
		// Clear all ping intervals
		for (const interval of this.pingIntervals.values()) {
			clearInterval(interval);
		}
		this.pingIntervals.clear();

		// Close all connections
		for (const conn of this.connections.values()) {
			conn.close();
		}
		this.connections.clear();
		this.peerStates.clear();
		this.reconnectAttempts.clear();
		this.missedPings.clear();

		// Destroy peer
		if (this.peer) {
			this.peer.destroy();
			this.peer = null;
		}

		this.myPeerId = null;
		this.emit('close');
	}

	/**
	 * Subscribe to events
	 */
	on<K extends keyof PeerManagerEvents>(event: K, callback: PeerManagerEvents[K]): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)!.add(callback as EventCallback<keyof PeerManagerEvents>);
	}

	/**
	 * Unsubscribe from events
	 */
	off<K extends keyof PeerManagerEvents>(event: K, callback: PeerManagerEvents[K]): void {
		this.eventListeners.get(event)?.delete(callback as EventCallback<keyof PeerManagerEvents>);
	}

	// === Private Methods ===

	private async initPeer(peerId?: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Peer initialization timeout'));
			}, CONNECTION_TIMEOUT_MS);

			this.peer = peerId ? new Peer(peerId, PEERJS_CONFIG) : new Peer(PEERJS_CONFIG);

			this.peer.on('open', (id) => {
				clearTimeout(timeout);
				this.myPeerId = id;
				this.setupPeerEvents();
				this.emit('open', id);
				resolve(id);
			});

			this.peer.on('error', (err) => {
				clearTimeout(timeout);
				this.emit('error', err);
				reject(err);
			});
		});
	}

	private setupPeerEvents(): void {
		if (!this.peer) return;

		// Handle incoming connections (host receives these)
		this.peer.on('connection', (conn) => {
			this.handleIncomingConnection(conn);
		});

		this.peer.on('disconnected', () => {
			// Try to reconnect to signaling server
			if (this.peer && !this.peer.destroyed) {
				this.peer.reconnect();
			}
		});

		this.peer.on('close', () => {
			this.emit('close');
		});

		this.peer.on('error', (err) => {
			this.emit('error', err);
		});
	}

	private handleIncomingConnection(conn: DataConnection): void {
		conn.on('open', () => {
			this.handleConnectionOpen(conn);
			this.emit('connection', conn.peer, conn);
		});
	}

	private handleConnectionOpen(conn: DataConnection): void {
		const peerId = conn.peer;
		this.connections.set(peerId, conn);
		this.peerStates.set(peerId, {
			peerId,
			playerId: '', // Will be set after player-join-accepted
			state: 'connected',
			lastPingTime: Date.now(),
			latency: null,
		});

		// Reset reconnect attempts on successful connection
		this.reconnectAttempts.delete(peerId);

		// Set up message handling
		conn.on('data', (data) => {
			this.handleMessage(peerId, data as BaseMessage);
		});

		conn.on('close', () => {
			this.handleConnectionClose(peerId);
		});

		conn.on('error', (err) => {
			logger.error`Connection error with ${peerId}: ${err}`;
			this.updatePeerState(peerId, 'error');
		});

		// Start ping/pong for health monitoring
		this.startPingInterval(peerId);
	}

	private handleConnectionClose(peerId: string): void {
		// Stop ping interval
		const interval = this.pingIntervals.get(peerId);
		if (interval) {
			clearInterval(interval);
			this.pingIntervals.delete(peerId);
		}

		// Clean up missed pings counter
		this.missedPings.delete(peerId);

		// Update state
		this.updatePeerState(peerId, 'disconnected');
		this.connections.delete(peerId);

		this.emit('disconnection', peerId);
	}

	private handleMessage(peerId: string, message: BaseMessage): void {
		// Handle ping/pong internally
		if (message.type === 'ping') {
			this.send(peerId, {
				type: 'pong',
				timestamp: Date.now(),
				senderId: this.myPeerId || '',
			});
			return;
		}

		if (message.type === 'pong') {
			const state = this.peerStates.get(peerId);
			if (state) {
				state.latency = Date.now() - message.timestamp;
				state.lastPingTime = Date.now();
			}
			// Reset missed pings counter on successful pong
			this.missedPings.set(peerId, 0);
			return;
		}

		// Forward other messages to listeners
		this.emit('message', peerId, message);
	}

	private startPingInterval(peerId: string): void {
		// Initialize missed pings counter
		this.missedPings.set(peerId, 0);

		const interval = setInterval(() => {
			const state = this.peerStates.get(peerId);
			if (!state) return;

			// Check if last ping was acknowledged
			if (state.lastPingTime && Date.now() - state.lastPingTime > PING_TIMEOUT_MS) {
				const missed = (this.missedPings.get(peerId) || 0) + 1;
				this.missedPings.set(peerId, missed);
				logger.warn`Missed ping ${missed}/${MAX_MISSED_PINGS} for ${peerId}`;

				// Only disconnect after MAX_MISSED_PINGS consecutive misses
				if (missed >= MAX_MISSED_PINGS) {
					logger.warn`Connection to ${peerId} timed out after ${missed} missed pings`;
					this.handleConnectionClose(peerId);
					return;
				}
			}

			// Send ping
			this.send(peerId, {
				type: 'ping',
				timestamp: Date.now(),
				senderId: this.myPeerId || '',
			});
		}, PING_INTERVAL_MS);

		this.pingIntervals.set(peerId, interval);
	}

	private updatePeerState(peerId: string, state: ConnectionState): void {
		const peerState = this.peerStates.get(peerId);
		if (peerState) {
			peerState.state = state;
		}
	}

	private emit<K extends keyof PeerManagerEvents>(
		event: K,
		...args: Parameters<PeerManagerEvents[K]>
	): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			for (const callback of listeners) {
				try {
					(callback as (...args: Parameters<PeerManagerEvents[K]>) => void)(...args);
				} catch (error) {
					logger.error`Error in event listener for ${event}: ${error}`;
				}
			}
		}
	}

	/**
	 * Associate a peer ID with a player ID
	 */
	setPlayerIdForPeer(peerId: string, playerId: PlayerId): void {
		const state = this.peerStates.get(peerId);
		if (state) {
			state.playerId = playerId;
		}
	}

	/**
	 * Get peer ID for a given player ID
	 */
	getPeerIdForPlayer(playerId: PlayerId): string | null {
		for (const [peerId, state] of this.peerStates) {
			if (state.playerId === playerId) {
				return peerId;
			}
		}
		return null;
	}

	/**
	 * Get player ID for a given peer ID
	 */
	getPlayerIdForPeer(peerId: string): PlayerId | null {
		return this.peerStates.get(peerId)?.playerId || null;
	}
}
