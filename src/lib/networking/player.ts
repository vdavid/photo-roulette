/**
 * Player networking functionality
 * Connects to host and receives game state updates
 */

import { getLogger } from '$lib/common/logging.js';
import type { DataConnection } from 'peerjs';
import type {
	PlayerId,
	Player,
	Photo,
	GameState,
	GameSettings,
	GamePhase,
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
	PlayerReconnectedMessage,
	PlayerKickedMessage,
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
import { createBaseMessage, dataToPlayerScores } from './types.js';
import { PeerManager } from './peer-manager.js';
import { normalizeRoomCode, isValidRoomCode } from './room-code.js';
import { RECONNECT_DELAY_MS, MAX_RECONNECT_ATTEMPTS } from './constants.js';

const logger = getLogger(['networking', 'player']);

/** Events emitted by PlayerNetwork */
export interface PlayerNetworkEvents {
	/** Successfully joined the game */
	joined: (playerId: PlayerId, players: Player[], settings: GameSettings, phase: GamePhase) => void;
	/** Join request was rejected */
	joinRejected: (reason: PlayerJoinRejectedMessage['reason']) => void;
	/** Disconnected from host */
	disconnected: () => void;
	/** Reconnected to host */
	reconnected: () => void;
	/** Kicked from the game */
	kicked: (reason?: string) => void;
	/** Player list updated */
	playerUpdate: (
		playerId: PlayerId,
		updates: Partial<Pick<Player, 'name' | 'emoji' | 'isReady' | 'isSpectator' | 'photoIds'>>
	) => void;
	/** Player left the game */
	playerLeft: (playerId: PlayerId) => void;
	/** Player reconnected */
	playerReconnected: (playerId: PlayerId) => void;
	/** Settings changed */
	settingsChanged: (settings: GameSettings) => void;
	/** Game is starting */
	gameStarting: (players: Player[], settings: GameSettings) => void;
	/** New round started */
	roundStart: (roundNumber: number, imageData: string, photoId: string, startTime: number) => void;
	/** Round ended with results */
	roundEnd: (
		result: RoundResult,
		scores: Map<PlayerId, import('../game/types.js').PlayerScore>
	) => void;
	/** Game ended */
	gameEnd: (finalResults: FinalResults) => void;
	/** Full state sync received */
	stateSync: (state: Partial<GameState>) => void;
	/** Error occurred */
	error: (error: Error) => void;
}

type EventCallback<K extends keyof PlayerNetworkEvents> = PlayerNetworkEvents[K];

/**
 * Player networking manager
 * Connects to a host and receives game state updates
 */
export class PlayerNetwork {
	private peerManager: PeerManager;
	private roomCode: string | null = null;
	private myPlayerId: PlayerId | null = null;
	private hostConnection: DataConnection | null = null;
	private reconnectAttempts = 0;
	private isReconnecting = false;
	private eventListeners: Map<
		keyof PlayerNetworkEvents,
		Set<EventCallback<keyof PlayerNetworkEvents>>
	> = new Map();

	constructor() {
		this.peerManager = new PeerManager();
		this.setupPeerEvents();
	}

	/** Get assigned player ID */
	get playerId(): PlayerId | null {
		return this.myPlayerId;
	}

	/** Get current room code */
	get code(): string | null {
		return this.roomCode;
	}

	/** Check if connected to host */
	get isConnected(): boolean {
		return this.hostConnection !== null && this.peerManager.isOpen;
	}

	/**
	 * Join a game room
	 */
	async joinRoom(roomCode: string, playerName: string, playerEmoji: string): Promise<void> {
		// Validate room code format
		const normalizedCode = normalizeRoomCode(roomCode);
		if (!isValidRoomCode(normalizedCode)) {
			throw new Error('Invalid room code format');
		}

		this.roomCode = normalizedCode;

		// Initialize our peer
		await this.peerManager.initAsPlayer();

		// Connect to host
		try {
			this.hostConnection = await this.peerManager.connectToHost(normalizedCode);

			// Send join request
			const joinRequest: PlayerJoinRequestMessage = {
				...createBaseMessage('player-join-request', ''),
				type: 'player-join-request',
				playerName,
				playerEmoji,
			};
			this.peerManager.send(this.hostConnection.peer, joinRequest);
		} catch (error) {
			this.peerManager.destroy();
			throw error;
		}
	}

	/**
	 * Rejoin a game room after a page refresh (using stored player ID)
	 */
	async rejoinRoom(
		roomCode: string,
		playerId: PlayerId,
		_playerName: string,
		_playerEmoji: string
	): Promise<void> {
		const normalizedCode = normalizeRoomCode(roomCode);
		if (!isValidRoomCode(normalizedCode)) {
			throw new Error('Invalid room code format');
		}

		this.roomCode = normalizedCode;
		this.myPlayerId = playerId;

		// Initialize our peer
		await this.peerManager.initAsPlayer();

		// Connect to host
		try {
			this.hostConnection = await this.peerManager.connectToHost(normalizedCode);

			// Send reconnect message with existing player ID
			const reconnectMessage: PlayerReconnectedMessage = {
				...createBaseMessage('player-reconnected', playerId),
				type: 'player-reconnected',
				playerId,
			};
			this.peerManager.send(this.hostConnection.peer, reconnectMessage);
		} catch (error) {
			this.peerManager.destroy();
			throw error;
		}
	}

	/**
	 * Leave the current game
	 */
	leaveRoom(): void {
		if (this.hostConnection && this.myPlayerId) {
			// Send leave message
			const leaveMessage: PlayerLeftMessage = {
				...createBaseMessage('player-left', this.myPlayerId),
				type: 'player-left',
				playerId: this.myPlayerId,
			};
			this.peerManager.send(this.hostConnection.peer, leaveMessage);
		}

		this.cleanup();
	}

	/**
	 * Update player info (name, emoji, ready state, spectator mode)
	 */
	sendPlayerUpdate(
		updates: Partial<Pick<Player, 'name' | 'emoji' | 'isReady' | 'isSpectator'>>
	): void {
		if (!this.hostConnection || !this.myPlayerId) return;

		const message: PlayerUpdateMessage = {
			...createBaseMessage('player-update', this.myPlayerId),
			type: 'player-update',
			playerId: this.myPlayerId,
			updates,
		};
		this.peerManager.send(this.hostConnection.peer, message);
	}

	/**
	 * Submit photos to the host
	 */
	sendPhotos(photos: Photo[]): void {
		if (!this.hostConnection || !this.myPlayerId) return;

		const message: PhotosSubmittedMessage = {
			...createBaseMessage('photos-submitted', this.myPlayerId),
			type: 'photos-submitted',
			playerId: this.myPlayerId,
			photos,
		};
		this.peerManager.send(this.hostConnection.peer, message);
	}

	/**
	 * Submit a guess for the current round
	 */
	sendGuess(guessedOwnerId: PlayerId): void {
		if (!this.hostConnection || !this.myPlayerId) return;

		const guess: Guess = {
			playerId: this.myPlayerId,
			guessedOwnerId,
			timestamp: Date.now(),
		};

		const message: GuessSubmittedMessage = {
			...createBaseMessage('guess-submitted', this.myPlayerId),
			type: 'guess-submitted',
			guess,
		};
		this.peerManager.send(this.hostConnection.peer, message);
	}

	/**
	 * Subscribe to events
	 */
	on<K extends keyof PlayerNetworkEvents>(event: K, callback: PlayerNetworkEvents[K]): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)!.add(callback as EventCallback<keyof PlayerNetworkEvents>);
	}

	/**
	 * Unsubscribe from events
	 */
	off<K extends keyof PlayerNetworkEvents>(event: K, callback: PlayerNetworkEvents[K]): void {
		this.eventListeners.get(event)?.delete(callback as EventCallback<keyof PlayerNetworkEvents>);
	}

	// === Private Methods ===

	private setupPeerEvents(): void {
		this.peerManager.on('message', (peerId, message) => {
			this.handleMessage(message);
		});

		this.peerManager.on('disconnection', () => {
			this.handleDisconnection();
		});

		this.peerManager.on('error', (error) => {
			this.emit('error', error);
		});
	}

	private handleMessage(message: NetworkMessage): void {
		switch (message.type) {
			case 'player-join-accepted':
				this.handleJoinAccepted(message as PlayerJoinAcceptedMessage);
				break;

			case 'player-join-rejected':
				this.handleJoinRejected(message as PlayerJoinRejectedMessage);
				break;

			case 'player-kicked':
				this.handleKicked(message as PlayerKickedMessage);
				break;

			case 'player-update':
				this.handlePlayerUpdate(message as PlayerUpdateMessage);
				break;

			case 'player-left':
				this.emit('playerLeft', (message as PlayerLeftMessage).playerId);
				break;

			case 'player-reconnected':
				this.emit('playerReconnected', (message as PlayerReconnectedMessage).playerId);
				break;

			case 'settings-changed':
				this.emit('settingsChanged', (message as SettingsChangedMessage).settings);
				break;

			case 'game-starting': {
				const startMsg = message as GameStartingMessage;
				this.emit('gameStarting', startMsg.players, startMsg.settings);
				break;
			}

			case 'round-start': {
				const roundMsg = message as RoundStartMessage;
				this.emit(
					'roundStart',
					roundMsg.roundNumber,
					roundMsg.imageData,
					roundMsg.photoId,
					roundMsg.startTime
				);
				break;
			}

			case 'round-end': {
				const endMsg = message as RoundEndMessage;
				this.emit('roundEnd', endMsg.result, dataToPlayerScores(endMsg.currentScores));
				break;
			}

			case 'game-end':
				this.emit('gameEnd', (message as GameEndMessage).finalResults);
				break;

			case 'state-sync':
				this.handleStateSync(message as StateSyncMessage);
				break;

			default:
				logger.warn`Player received unexpected message type: ${message.type}`;
		}
	}

	private handleJoinAccepted(message: PlayerJoinAcceptedMessage): void {
		this.myPlayerId = message.playerId;
		this.reconnectAttempts = 0;
		this.emit('joined', message.playerId, message.players, message.settings, message.phase);
	}

	private handleJoinRejected(message: PlayerJoinRejectedMessage): void {
		this.emit('joinRejected', message.reason);
		this.cleanup();
	}

	private handleKicked(message: PlayerKickedMessage): void {
		this.emit('kicked', message.reason);
		this.cleanup();
	}

	private handlePlayerUpdate(message: PlayerUpdateMessage): void {
		this.emit('playerUpdate', message.playerId, message.updates);
	}

	private handleStateSync(message: StateSyncMessage): void {
		const partialState: Partial<GameState> = {
			phase: message.phase,
			settings: message.settings,
			players: message.players,
			currentRound: message.currentRound,
			roundResults: message.roundResults,
			playerScores: dataToPlayerScores(message.playerScores),
		};
		this.emit('stateSync', partialState);
	}

	private handleDisconnection(): void {
		this.emit('disconnected');

		// Attempt to reconnect if we were previously connected
		if (this.myPlayerId && this.roomCode && !this.isReconnecting) {
			this.attemptReconnect();
		}
	}

	private async attemptReconnect(): Promise<void> {
		if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			logger.info`Max reconnect attempts reached`;
			this.cleanup();
			return;
		}

		this.isReconnecting = true;
		this.reconnectAttempts++;

		logger.info`Reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`;

		await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));

		try {
			// Re-initialize peer
			await this.peerManager.initAsPlayer();

			// Reconnect to host
			this.hostConnection = await this.peerManager.connectToHost(this.roomCode!);

			// Send reconnect message
			const reconnectMessage: PlayerReconnectedMessage = {
				...createBaseMessage('player-reconnected', this.myPlayerId!),
				type: 'player-reconnected',
				playerId: this.myPlayerId!,
			};
			this.peerManager.send(this.hostConnection.peer, reconnectMessage);

			this.isReconnecting = false;
			this.reconnectAttempts = 0;
			this.emit('reconnected');
		} catch (error) {
			this.isReconnecting = false;
			logger.error`Reconnect failed: ${error}`;
			this.attemptReconnect();
		}
	}

	private cleanup(): void {
		this.peerManager.destroy();
		this.hostConnection = null;
		this.roomCode = null;
		this.myPlayerId = null;
		this.reconnectAttempts = 0;
		this.isReconnecting = false;
	}

	private emit<K extends keyof PlayerNetworkEvents>(
		event: K,
		...args: Parameters<PlayerNetworkEvents[K]>
	): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			for (const callback of listeners) {
				try {
					(callback as (...args: Parameters<PlayerNetworkEvents[K]>) => void)(...args);
				} catch (error) {
					logger.error`Error in event listener for ${event}: ${error}`;
				}
			}
		}
	}
}
