/**
 * Host networking functionality
 * Manages game state and broadcasts to all players
 */

import type {
	PlayerId,
	Player,
	Photo,
	GameState,
	GameSettings,
	Guess,
	RoundResult,
	FinalResults,
} from '$lib/game';
import type {
	NetworkMessage,
	PlayerJoinRequestMessage,
	PlayerJoinAcceptedMessage,
	PlayerJoinRejectedMessage,
	PlayerLeftMessage,
	PlayerUpdateMessage,
	PhotosSubmittedMessage,
	SettingsChangedMessage,
	GameStartingMessage,
	RoundStartMessage,
	GuessSubmittedMessage,
	RoundEndMessage,
	GameEndMessage,
	StateSyncMessage,
} from './types.js';
import { createBaseMessage, playerScoresToData } from './types.js';
import { PeerManager } from './peer-manager.js';
import { generateRoomCode } from './room-code.js';

/** Events emitted by HostNetwork */
export interface HostNetworkEvents {
	/** Room created and ready */
	roomReady: (roomCode: string) => void;
	/** Player requesting to join */
	playerJoinRequest: (
		peerId: string,
		name: string,
		emoji: string,
		accept: (playerId: PlayerId) => void,
		reject: (reason: PlayerJoinRejectedMessage['reason']) => void
	) => void;
	/** Player disconnected */
	playerDisconnected: (playerId: PlayerId) => void;
	/** Player reconnected */
	playerReconnected: (playerId: PlayerId) => void;
	/** Player updated their info */
	playerUpdate: (
		playerId: PlayerId,
		updates: Partial<Pick<Player, 'name' | 'emoji' | 'isReady' | 'isSpectator'>>
	) => void;
	/** Player submitted photos */
	photosSubmitted: (playerId: PlayerId, photos: Photo[]) => void;
	/** Player submitted a guess */
	guessReceived: (playerId: PlayerId, guess: Guess) => void;
	/** Error occurred */
	error: (error: Error) => void;
}

type EventCallback<K extends keyof HostNetworkEvents> = HostNetworkEvents[K];

/**
 * Host networking manager
 * Creates and manages the game room, handles player connections
 */
export class HostNetwork {
	private peerManager: PeerManager;
	private roomCode: string | null = null;
	private hostPlayerId: PlayerId;
	private eventListeners: Map<
		keyof HostNetworkEvents,
		Set<EventCallback<keyof HostNetworkEvents>>
	> = new Map();

	constructor(hostPlayerId: PlayerId) {
		this.peerManager = new PeerManager();
		this.hostPlayerId = hostPlayerId;
		this.setupPeerEvents();
	}

	/** Get the room code */
	get code(): string | null {
		return this.roomCode;
	}

	/** Check if host is active */
	get isActive(): boolean {
		return this.peerManager.isOpen;
	}

	/** Get number of connected players */
	get connectedPlayerCount(): number {
		return this.peerManager.activeConnections.length;
	}

	/**
	 * Create a new game room
	 */
	async createRoom(): Promise<string> {
		// Generate a unique room code
		this.roomCode = generateRoomCode();

		try {
			await this.peerManager.initAsHost(this.roomCode);
			this.emit('roomReady', this.roomCode);
			return this.roomCode;
		} catch (error) {
			// If peer ID is taken, try again with a new code
			if ((error as Error).message.includes('unavailable')) {
				this.roomCode = generateRoomCode();
				await this.peerManager.initAsHost(this.roomCode);
				this.emit('roomReady', this.roomCode);
				return this.roomCode;
			}
			throw error;
		}
	}

	/**
	 * Close the room and disconnect all players
	 */
	closeRoom(): void {
		this.peerManager.destroy();
		this.roomCode = null;
	}

	/**
	 * Kick a player from the game
	 */
	kickPlayer(playerId: PlayerId, reason?: string): void {
		const peerId = this.peerManager.getPeerIdForPlayer(playerId);
		if (!peerId) return;

		// Send kick message
		this.peerManager.send(peerId, {
			...createBaseMessage('player-kicked', this.hostPlayerId),
			type: 'player-kicked',
			playerId,
			reason,
		});

		// Disconnect them
		this.peerManager.disconnectPeer(peerId);
	}

	/**
	 * Broadcast player list update to all players
	 */
	broadcastPlayerUpdate(
		playerId: PlayerId,
		updates: Partial<Pick<Player, 'name' | 'emoji' | 'isReady' | 'isSpectator'>>
	): void {
		const message: PlayerUpdateMessage = {
			...createBaseMessage('player-update', this.hostPlayerId),
			type: 'player-update',
			playerId,
			updates,
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Broadcast settings change to all players
	 */
	broadcastSettingsChange(settings: GameSettings): void {
		const message: SettingsChangedMessage = {
			...createBaseMessage('settings-changed', this.hostPlayerId),
			type: 'settings-changed',
			settings,
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Broadcast game starting
	 */
	broadcastGameStarting(players: Player[], settings: GameSettings): void {
		const message: GameStartingMessage = {
			...createBaseMessage('game-starting', this.hostPlayerId),
			type: 'game-starting',
			players,
			settings,
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Broadcast round start with image data
	 */
	broadcastRoundStart(
		roundNumber: number,
		imageData: string,
		photoId: string,
		startTime: number
	): void {
		const message: RoundStartMessage = {
			...createBaseMessage('round-start', this.hostPlayerId),
			type: 'round-start',
			roundNumber,
			imageData,
			photoId,
			startTime,
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Broadcast guess count update (how many have guessed)
	 * Note: We reuse the existing message types - just broadcast to inform UI
	 */
	broadcastGuessCount(_guessCount: number, _totalPlayers: number): void {
		// This is handled by state sync or custom message if needed
		// For now, we'll rely on state sync
	}

	/**
	 * Broadcast round end with results
	 */
	broadcastRoundEnd(
		result: RoundResult,
		scores: Map<PlayerId, import('../game/types.js').PlayerScore>
	): void {
		const message: RoundEndMessage = {
			...createBaseMessage('round-end', this.hostPlayerId),
			type: 'round-end',
			result,
			currentScores: playerScoresToData(scores),
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Broadcast game end with final results
	 */
	broadcastGameEnd(finalResults: FinalResults): void {
		const message: GameEndMessage = {
			...createBaseMessage('game-end', this.hostPlayerId),
			type: 'game-end',
			finalResults,
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Send full state sync to a specific player (for reconnects)
	 */
	sendStateSync(playerId: PlayerId, state: GameState): void {
		const peerId = this.peerManager.getPeerIdForPlayer(playerId);
		if (!peerId) return;

		const message: StateSyncMessage = {
			...createBaseMessage('state-sync', this.hostPlayerId),
			type: 'state-sync',
			phase: state.phase,
			settings: state.settings,
			players: state.players,
			currentRound: state.currentRound,
			roundResults: state.roundResults,
			playerScores: playerScoresToData(state.playerScores),
		};
		this.peerManager.send(peerId, message);
	}

	/**
	 * Broadcast that a player left
	 */
	broadcastPlayerLeft(playerId: PlayerId): void {
		const message: PlayerLeftMessage = {
			...createBaseMessage('player-left', this.hostPlayerId),
			type: 'player-left',
			playerId,
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Subscribe to events
	 */
	on<K extends keyof HostNetworkEvents>(event: K, callback: HostNetworkEvents[K]): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)!.add(callback as EventCallback<keyof HostNetworkEvents>);
	}

	/**
	 * Unsubscribe from events
	 */
	off<K extends keyof HostNetworkEvents>(event: K, callback: HostNetworkEvents[K]): void {
		this.eventListeners.get(event)?.delete(callback as EventCallback<keyof HostNetworkEvents>);
	}

	// === Private Methods ===

	private setupPeerEvents(): void {
		this.peerManager.on('connection', (peerId, _conn) => {
			// New peer connected, wait for join request
			console.log(`New connection from ${peerId}`);
		});

		this.peerManager.on('message', (peerId, message) => {
			this.handleMessage(peerId, message);
		});

		this.peerManager.on('disconnection', (peerId) => {
			const playerId = this.peerManager.getPlayerIdForPeer(peerId);
			if (playerId) {
				this.emit('playerDisconnected', playerId);
			}
		});

		this.peerManager.on('error', (error) => {
			this.emit('error', error);
		});
	}

	private handleMessage(peerId: string, message: NetworkMessage): void {
		switch (message.type) {
			case 'player-join-request':
				this.handleJoinRequest(peerId, message as PlayerJoinRequestMessage);
				break;

			case 'player-update':
				this.handlePlayerUpdate(peerId, message as PlayerUpdateMessage);
				break;

			case 'photos-submitted':
				this.handlePhotosSubmitted(message as PhotosSubmittedMessage);
				break;

			case 'guess-submitted':
				this.handleGuessSubmitted(message as GuessSubmittedMessage);
				break;

			default:
				console.warn(`Host received unexpected message type: ${message.type}`);
		}
	}

	private handleJoinRequest(peerId: string, message: PlayerJoinRequestMessage): void {
		const { playerName, playerEmoji } = message;

		// Create accept/reject callbacks
		const accept = (playerId: PlayerId) => {
			this.peerManager.setPlayerIdForPeer(peerId, playerId);
			// Note: The actual acceptance message will be sent by the game state manager
			// which has access to the full player list and settings
		};

		const reject = (reason: PlayerJoinRejectedMessage['reason']) => {
			const rejectMessage: PlayerJoinRejectedMessage = {
				...createBaseMessage('player-join-rejected', this.hostPlayerId),
				type: 'player-join-rejected',
				reason,
			};
			this.peerManager.send(peerId, rejectMessage);
			this.peerManager.disconnectPeer(peerId);
		};

		// Emit event for game state manager to handle
		this.emit('playerJoinRequest', peerId, playerName, playerEmoji, accept, reject);
	}

	private handlePlayerUpdate(peerId: string, message: PlayerUpdateMessage): void {
		const playerId = this.peerManager.getPlayerIdForPeer(peerId);
		if (!playerId) return;

		this.emit('playerUpdate', playerId, message.updates);
	}

	private handlePhotosSubmitted(message: PhotosSubmittedMessage): void {
		this.emit('photosSubmitted', message.playerId, message.photos);
	}

	private handleGuessSubmitted(message: GuessSubmittedMessage): void {
		this.emit('guessReceived', message.guess.playerId, message.guess);
	}

	private emit<K extends keyof HostNetworkEvents>(
		event: K,
		...args: Parameters<HostNetworkEvents[K]>
	): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			for (const callback of listeners) {
				try {
					(callback as (...args: Parameters<HostNetworkEvents[K]>) => void)(...args);
				} catch (error) {
					console.error(`Error in event listener for ${event}:`, error);
				}
			}
		}
	}

	/**
	 * Send join accepted message to a player
	 */
	sendJoinAccepted(
		peerId: string,
		playerId: PlayerId,
		players: Player[],
		settings: GameSettings,
		phase: import('../game/types.js').GamePhase
	): void {
		const message: PlayerJoinAcceptedMessage = {
			...createBaseMessage('player-join-accepted', this.hostPlayerId),
			type: 'player-join-accepted',
			playerId,
			players,
			settings,
			phase,
		};
		this.peerManager.send(peerId, message);
	}

	/**
	 * Get peer ID for a player
	 */
	getPeerIdForPlayer(playerId: PlayerId): string | null {
		return this.peerManager.getPeerIdForPlayer(playerId);
	}
}
