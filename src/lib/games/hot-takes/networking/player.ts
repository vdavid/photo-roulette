/**
 * Hot Takes player networking functionality
 * Connects to host and receives game state updates
 */

import type { DataConnection } from 'peerjs';
import type { PlayerId } from '$lib/common/networking/types.js';
import type {
	HotTake,
	HotTakesPhase,
	HotTakesSettings,
	HotTakesPlayer as HotTakesPlayerType,
	Vote,
	Guess,
	TakeResult,
	PlayerScore,
	FinalResults,
	CurrentRound,
} from '../logic/types.js';
import type {
	HotTakesMessage,
	PlayerJoinAcceptedMessage,
	PlayerUpdateMessage,
	VotingStartMessage,
	VotingEndMessage,
	GuessingStartMessage,
	TakeRevealMessage,
	GameEndMessage,
	SettingsChangedMessage,
	GameStartingMessage,
	StateSyncMessage,
	AllTakesReadyMessage,
	TakeSubmittedMessage,
	VoteSubmittedMessage,
	GuessSubmittedMessage,
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

/** Events emitted by HotTakesPlayer */
export interface HotTakesPlayerEvents {
	/** Successfully joined the game */
	joined: (
		playerId: PlayerId,
		players: HotTakesPlayerType[],
		settings: HotTakesSettings,
		phase: HotTakesPhase
	) => void;
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
		updates: Partial<Pick<HotTakesPlayerType, 'name' | 'emoji' | 'isReady' | 'isSpectator'>>
	) => void;
	/** Player left the game */
	playerLeft: (playerId: PlayerId) => void;
	/** Player reconnected */
	playerReconnected: (playerId: PlayerId) => void;
	/** Settings changed */
	settingsChanged: (settings: HotTakesSettings) => void;
	/** Game is starting */
	gameStarting: (players: HotTakesPlayerType[], settings: HotTakesSettings) => void;
	/** All takes submitted */
	allTakesReady: (totalTakes: number) => void;
	/** Voting started for a take */
	votingStart: (
		take: Omit<HotTake, 'authorId'>,
		takeIndex: number,
		totalTakes: number,
		startTime: number,
		votingTimeSeconds: number
	) => void;
	/** Voting ended for a take */
	votingEnd: (takeId: string, votes: Vote[], agreePercent: number) => void;
	/** Guessing started for a take */
	guessingStart: (
		takeId: string,
		votes: Vote[],
		agreePercent: number,
		startTime: number,
		guessingTimeSeconds: number
	) => void;
	/** Take revealed with results */
	takeReveal: (
		result: TakeResult,
		authorName: string,
		authorEmoji: string,
		currentScores: Map<PlayerId, PlayerScore>
	) => void;
	/** Game ended */
	gameEnd: (finalResults: FinalResults) => void;
	/** Full state sync received */
	stateSync: (
		phase: HotTakesPhase,
		settings: HotTakesSettings,
		players: HotTakesPlayerType[],
		currentRound: CurrentRound | null,
		takeResults: TakeResult[],
		playerScores: Map<PlayerId, PlayerScore>
	) => void;
	/** Error occurred */
	error: (error: Error) => void;
}

type EventCallback<K extends keyof HotTakesPlayerEvents> = HotTakesPlayerEvents[K];

/**
 * Hot Takes player networking manager
 */
export class HotTakesPlayerNetwork {
	private peerManager: PeerManager;
	private roomCode: string | null = null;
	private myPlayerId: PlayerId | null = null;
	private hostConnection: DataConnection | null = null;
	private reconnectAttempts = 0;
	private isReconnecting = false;
	private eventListeners: Map<
		keyof HotTakesPlayerEvents,
		Set<EventCallback<keyof HotTakesPlayerEvents>>
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
		updates: Partial<Pick<HotTakesPlayerType, 'name' | 'emoji' | 'isReady' | 'isSpectator'>>
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
	 * Submit a hot take to the host
	 */
	sendTake(take: { id: string; text: string }): void {
		if (!this.hostConnection || !this.myPlayerId) return;

		const message: TakeSubmittedMessage = {
			...createBaseMessage('take-submitted', this.myPlayerId),
			type: 'take-submitted',
			playerId: this.myPlayerId,
			take,
		};
		this.peerManager.send(this.hostConnection.peer, message);
	}

	/**
	 * Submit a vote for the current take
	 */
	sendVote(takeId: string, vote: 'agree' | 'disagree'): void {
		if (!this.hostConnection || !this.myPlayerId) return;

		const voteData: Vote = {
			playerId: this.myPlayerId,
			takeId,
			vote,
		};

		const message: VoteSubmittedMessage = {
			...createBaseMessage('vote-submitted', this.myPlayerId),
			type: 'vote-submitted',
			vote: voteData,
		};
		this.peerManager.send(this.hostConnection.peer, message);
	}

	/**
	 * Submit a guess for the current take's author
	 */
	sendGuess(takeId: string, guessedAuthorId: PlayerId): void {
		if (!this.hostConnection || !this.myPlayerId) return;

		const guessData: Guess = {
			playerId: this.myPlayerId,
			takeId,
			guessedAuthorId,
		};

		const message: GuessSubmittedMessage = {
			...createBaseMessage('guess-submitted', this.myPlayerId),
			type: 'guess-submitted',
			guess: guessData,
		};
		this.peerManager.send(this.hostConnection.peer, message);
	}

	/**
	 * Subscribe to events
	 */
	on<K extends keyof HotTakesPlayerEvents>(event: K, callback: HotTakesPlayerEvents[K]): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)!.add(callback as EventCallback<keyof HotTakesPlayerEvents>);
	}

	/**
	 * Unsubscribe from events
	 */
	off<K extends keyof HotTakesPlayerEvents>(event: K, callback: HotTakesPlayerEvents[K]): void {
		this.eventListeners.get(event)?.delete(callback as EventCallback<keyof HotTakesPlayerEvents>);
	}

	// === Private Methods ===

	private setupPeerEvents(): void {
		this.peerManager.on('message', (_peerId, message) => {
			this.handleMessage(message as HotTakesMessage);
		});

		this.peerManager.on('disconnection', () => {
			this.handleDisconnection();
		});

		this.peerManager.on('error', (error) => {
			this.emit('error', error);
		});
	}

	private handleMessage(message: HotTakesMessage): void {
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

			case 'all-takes-ready': {
				const readyMsg = message as AllTakesReadyMessage;
				this.emit('allTakesReady', readyMsg.totalTakes);
				break;
			}

			case 'voting-start': {
				const votingMsg = message as VotingStartMessage;
				this.emit(
					'votingStart',
					votingMsg.take,
					votingMsg.takeIndex,
					votingMsg.totalTakes,
					votingMsg.startTime,
					votingMsg.votingTimeSeconds
				);
				break;
			}

			case 'voting-end': {
				const endMsg = message as VotingEndMessage;
				this.emit('votingEnd', endMsg.takeId, endMsg.votes, endMsg.agreePercent);
				break;
			}

			case 'guessing-start': {
				const guessMsg = message as GuessingStartMessage;
				this.emit(
					'guessingStart',
					guessMsg.takeId,
					guessMsg.votes,
					guessMsg.agreePercent,
					guessMsg.startTime,
					guessMsg.guessingTimeSeconds
				);
				break;
			}

			case 'take-reveal': {
				const revealMsg = message as TakeRevealMessage;
				this.emit(
					'takeReveal',
					revealMsg.result,
					revealMsg.authorName,
					revealMsg.authorEmoji,
					dataToPlayerScores(revealMsg.currentScores)
				);
				break;
			}

			case 'game-end':
				this.emit('gameEnd', (message as GameEndMessage).finalResults);
				break;

			case 'state-sync':
				this.handleStateSync(message as StateSyncMessage);
				break;

			default:
				console.warn(`Player received unexpected message type: ${message.type}`);
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
		this.emit(
			'stateSync',
			message.phase,
			message.settings,
			message.players,
			message.currentRound,
			message.takeResults,
			dataToPlayerScores(message.playerScores)
		);
	}

	private handleDisconnection(): void {
		this.emit('disconnected');

		if (this.myPlayerId && this.roomCode && !this.isReconnecting) {
			this.attemptReconnect();
		}
	}

	private async attemptReconnect(): Promise<void> {
		if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			console.log('Max reconnect attempts reached');
			this.cleanup();
			return;
		}

		this.isReconnecting = true;
		this.reconnectAttempts++;

		console.log(`Reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

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
			console.error('Reconnect failed:', error);
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

	private emit<K extends keyof HotTakesPlayerEvents>(
		event: K,
		...args: Parameters<HotTakesPlayerEvents[K]>
	): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			for (const callback of listeners) {
				try {
					(callback as (...args: Parameters<HotTakesPlayerEvents[K]>) => void)(...args);
				} catch (error) {
					console.error(`Error in event listener for ${event}:`, error);
				}
			}
		}
	}
}
