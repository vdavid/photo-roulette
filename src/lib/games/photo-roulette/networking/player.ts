/**
 * Photo Roulette player networking functionality
 * Connects to host and receives game state updates
 */

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
} from '../logic/types.js';
import type {
	PhotoRouletteMessage,
	PlayerJoinAcceptedMessage,
	PlayerUpdateMessage,
	PhotosSubmittedMessage,
	SettingsChangedMessage,
	GameStartingMessage,
	RoundStartMessage,
	RoundEndMessage,
	GameEndMessage,
	StateSyncMessage,
} from './types.js';
import { dataToPlayerScores } from './types.js';
import {
	PeerManager,
	normalizeRoomCode,
	isValidRoomCode,
	createBaseMessage,
	RECONNECT_DELAY_MS,
	MAX_RECONNECT_ATTEMPTS,
} from '$lib/common/networking/index.js';
import type {
	JoinRejectionReason,
	PlayerJoinRejectedMessage,
} from '$lib/common/networking/types.js';
import { getLogger } from '$lib/common/logging.js';

const logger = getLogger(['game', 'photo-roulette']);

/** Events emitted by PhotoRoulettePlayer */
export interface PhotoRoulettePlayerEvents {
	/** Successfully joined the game */
	joined: (playerId: PlayerId, players: Player[], settings: GameSettings, phase: GamePhase) => void;
	/** Join request was rejected */
	joinRejected: (reason: JoinRejectionReason) => void;
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
		scores: Map<PlayerId, import('../logic/types.js').PlayerScore>
	) => void;
	/** Game ended */
	gameEnd: (finalResults: FinalResults) => void;
	/** Full state sync received */
	stateSync: (state: Partial<GameState>) => void;
	/** Error occurred */
	error: (error: Error) => void;
}

type EventCallback<K extends keyof PhotoRoulettePlayerEvents> = PhotoRoulettePlayerEvents[K];

/**
 * Photo Roulette player networking manager
 */
export class PhotoRoulettePlayer {
	private peerManager: PeerManager;
	private roomCode: string | null = null;
	private myPlayerId: PlayerId | null = null;
	private hostConnection: DataConnection | null = null;
	private reconnectAttempts = 0;
	private isReconnecting = false;
	private eventListeners: Map<
		keyof PhotoRoulettePlayerEvents,
		Set<EventCallback<keyof PhotoRoulettePlayerEvents>>
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
		const normalizedCode = normalizeRoomCode(roomCode);
		if (!isValidRoomCode(normalizedCode)) {
			throw new Error('Invalid room code format');
		}

		this.roomCode = normalizedCode;

		await this.peerManager.initAsPlayer();

		try {
			this.hostConnection = await this.peerManager.connectToHost(normalizedCode);

			const joinRequest = {
				...createBaseMessage('player-join-request', ''),
				type: 'player-join-request' as const,
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

		await this.peerManager.initAsPlayer();

		try {
			this.hostConnection = await this.peerManager.connectToHost(normalizedCode);

			const reconnectMessage = {
				...createBaseMessage('player-reconnected', playerId),
				type: 'player-reconnected' as const,
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
			const leaveMessage = {
				...createBaseMessage('player-left', this.myPlayerId),
				type: 'player-left' as const,
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

		const message = {
			...createBaseMessage('guess-submitted', this.myPlayerId),
			type: 'guess-submitted' as const,
			guess,
		};
		this.peerManager.send(this.hostConnection.peer, message);
	}

	/**
	 * Subscribe to events
	 */
	on<K extends keyof PhotoRoulettePlayerEvents>(
		event: K,
		callback: PhotoRoulettePlayerEvents[K]
	): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)!.add(callback as EventCallback<keyof PhotoRoulettePlayerEvents>);
	}

	/**
	 * Unsubscribe from events
	 */
	off<K extends keyof PhotoRoulettePlayerEvents>(
		event: K,
		callback: PhotoRoulettePlayerEvents[K]
	): void {
		this.eventListeners
			.get(event)
			?.delete(callback as EventCallback<keyof PhotoRoulettePlayerEvents>);
	}

	// === Private Methods ===

	private setupPeerEvents(): void {
		this.peerManager.on('message', (_peerId, message) => {
			this.handleMessage(message as PhotoRouletteMessage);
		});

		this.peerManager.on('disconnection', () => {
			this.handleDisconnection();
		});

		this.peerManager.on('error', (error) => {
			this.emit('error', error);
		});
	}

	private handleMessage(message: PhotoRouletteMessage): void {
		switch (message.type) {
			case 'player-join-accepted':
				this.handleJoinAccepted(message as PlayerJoinAcceptedMessage);
				break;

			case 'player-join-rejected':
				this.handleJoinRejected(message as PlayerJoinRejectedMessage);
				break;

			case 'player-kicked':
				this.handleKicked(message as { reason?: string });
				break;

			case 'player-update':
				this.handlePlayerUpdate(message as PlayerUpdateMessage);
				break;

			case 'player-left':
				this.emit('playerLeft', (message as { playerId: PlayerId }).playerId);
				break;

			case 'player-reconnected':
				this.emit('playerReconnected', (message as { playerId: PlayerId }).playerId);
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

	private handleKicked(message: { reason?: string }): void {
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
			await this.peerManager.initAsPlayer();

			this.hostConnection = await this.peerManager.connectToHost(this.roomCode!);

			const reconnectMessage = {
				...createBaseMessage('player-reconnected', this.myPlayerId!),
				type: 'player-reconnected' as const,
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

	private emit<K extends keyof PhotoRoulettePlayerEvents>(
		event: K,
		...args: Parameters<PhotoRoulettePlayerEvents[K]>
	): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			for (const callback of listeners) {
				try {
					(callback as (...args: Parameters<PhotoRoulettePlayerEvents[K]>) => void)(...args);
				} catch (error) {
					logger.error`Error in event listener for ${event}: ${error}`;
				}
			}
		}
	}
}
