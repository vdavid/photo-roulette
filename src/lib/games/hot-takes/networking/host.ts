/**
 * Hot Takes host networking functionality
 * Manages game state and broadcasts to all players
 */

import type { PlayerId } from '$lib/common/networking/types.js';
import type {
	HotTake,
	HotTakesPhase,
	HotTakesSettings,
	HotTakesPlayer,
	Vote,
	Guess,
	TakeResult,
	PlayerScore,
	FinalResults,
	CurrentRound,
} from '../logic/types.js';
import type {
	HotTakesMessage,
	PlayerJoinRequestMessage,
	TakeSubmittedMessage,
	VoteSubmittedMessage,
	GuessSubmittedMessage,
	PlayerUpdateMessage,
	PlayerJoinAcceptedMessage,
	PlayerLeftMessage,
	SettingsChangedMessage,
	GameStartingMessage,
	VotingStartMessage,
	VotingEndMessage,
	GuessingStartMessage,
	TakeRevealMessage,
	GameEndMessage,
	StateSyncMessage,
	AllTakesReadyMessage,
} from './types.js';
import { playerScoresToData } from './types.js';
import { PeerManager, generateRoomCode, createBaseMessage } from '$lib/common/networking/index.js';
import type { JoinRejectionReason } from '$lib/common/networking/types.js';
import { getLogger } from '$lib/common/logging.js';

const logger = getLogger(['game', 'hot-takes']);

/** Events emitted by HotTakesHost */
export interface HotTakesHostEvents {
	/** Room created and ready */
	roomReady: (roomCode: string) => void;
	/** Player requesting to join */
	playerJoinRequest: (
		peerId: string,
		name: string,
		emoji: string,
		accept: (playerId: PlayerId) => void,
		reject: (reason: JoinRejectionReason) => void
	) => void;
	/** Player disconnected */
	playerDisconnected: (playerId: PlayerId) => void;
	/** Player reconnected */
	playerReconnected: (playerId: PlayerId) => void;
	/** Player updated their info */
	playerUpdate: (
		playerId: PlayerId,
		updates: Partial<Pick<HotTakesPlayer, 'name' | 'emoji' | 'isReady' | 'isSpectator'>>
	) => void;
	/** Player submitted a hot take */
	takeSubmitted: (playerId: PlayerId, take: { id: string; text: string }) => void;
	/** Player submitted a vote */
	voteReceived: (vote: Vote) => void;
	/** Player submitted a guess */
	guessReceived: (guess: Guess) => void;
	/** Error occurred */
	error: (error: Error) => void;
}

type EventCallback<K extends keyof HotTakesHostEvents> = HotTakesHostEvents[K];

/**
 * Hot Takes host networking manager
 */
export class HotTakesHost {
	private peerManager: PeerManager;
	private roomCode: string | null = null;
	private hostPlayerId: PlayerId;
	private eventListeners: Map<
		keyof HotTakesHostEvents,
		Set<EventCallback<keyof HotTakesHostEvents>>
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
		this.roomCode = generateRoomCode();

		try {
			await this.peerManager.initAsHost(this.roomCode);
			this.emit('roomReady', this.roomCode);
			return this.roomCode;
		} catch (error) {
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

		const message = {
			...createBaseMessage('player-kicked', this.hostPlayerId),
			type: 'player-kicked' as const,
			playerId,
			reason,
		};
		this.peerManager.send(peerId, message);
		this.peerManager.disconnectPeer(peerId);
	}

	/**
	 * Send join accepted message to a player
	 */
	sendJoinAccepted(
		peerId: string,
		playerId: PlayerId,
		players: HotTakesPlayer[],
		settings: HotTakesSettings,
		phase: HotTakesPhase
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
	 * Broadcast player list update to all players
	 */
	broadcastPlayerUpdate(
		playerId: PlayerId,
		updates: Partial<Pick<HotTakesPlayer, 'name' | 'emoji' | 'isReady' | 'isSpectator'>>
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
	broadcastSettingsChange(settings: HotTakesSettings): void {
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
	broadcastGameStarting(players: HotTakesPlayer[], settings: HotTakesSettings): void {
		const message: GameStartingMessage = {
			...createBaseMessage('game-starting', this.hostPlayerId),
			type: 'game-starting',
			players,
			settings,
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Broadcast that all takes are submitted and ready
	 */
	broadcastAllTakesReady(totalTakes: number): void {
		const message: AllTakesReadyMessage = {
			...createBaseMessage('all-takes-ready', this.hostPlayerId),
			type: 'all-takes-ready',
			totalTakes,
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Broadcast voting start for a take
	 */
	broadcastVotingStart(
		take: Omit<HotTake, 'authorId'>,
		takeIndex: number,
		totalTakes: number,
		votingTimeSeconds: number
	): void {
		const message: VotingStartMessage = {
			...createBaseMessage('voting-start', this.hostPlayerId),
			type: 'voting-start',
			take,
			takeIndex,
			totalTakes,
			startTime: Date.now(),
			votingTimeSeconds,
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Broadcast voting ended for a take
	 */
	broadcastVotingEnd(takeId: string, votes: Vote[], agreePercent: number): void {
		const message: VotingEndMessage = {
			...createBaseMessage('voting-end', this.hostPlayerId),
			type: 'voting-end',
			takeId,
			votes,
			agreePercent,
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Broadcast guessing start for a take
	 */
	broadcastGuessingStart(
		takeId: string,
		votes: Vote[],
		agreePercent: number,
		guessingTimeSeconds: number
	): void {
		const message: GuessingStartMessage = {
			...createBaseMessage('guessing-start', this.hostPlayerId),
			type: 'guessing-start',
			takeId,
			votes,
			agreePercent,
			startTime: Date.now(),
			guessingTimeSeconds,
		};
		this.peerManager.broadcast(message);
	}

	/**
	 * Broadcast take reveal with results
	 */
	broadcastTakeReveal(
		result: TakeResult,
		authorName: string,
		authorEmoji: string,
		currentScores: Map<PlayerId, PlayerScore>
	): void {
		const message: TakeRevealMessage = {
			...createBaseMessage('take-reveal', this.hostPlayerId),
			type: 'take-reveal',
			result,
			authorName,
			authorEmoji,
			currentScores: playerScoresToData(currentScores),
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
	sendStateSync(
		playerId: PlayerId,
		phase: HotTakesPhase,
		settings: HotTakesSettings,
		players: HotTakesPlayer[],
		currentRound: CurrentRound | null,
		takeResults: TakeResult[],
		playerScores: Map<PlayerId, PlayerScore>
	): void {
		const peerId = this.peerManager.getPeerIdForPlayer(playerId);
		if (!peerId) return;

		const message: StateSyncMessage = {
			...createBaseMessage('state-sync', this.hostPlayerId),
			type: 'state-sync',
			phase,
			settings,
			players,
			currentRound,
			takeResults,
			playerScores: playerScoresToData(playerScores),
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
	on<K extends keyof HotTakesHostEvents>(event: K, callback: HotTakesHostEvents[K]): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)!.add(callback as EventCallback<keyof HotTakesHostEvents>);
	}

	/**
	 * Unsubscribe from events
	 */
	off<K extends keyof HotTakesHostEvents>(event: K, callback: HotTakesHostEvents[K]): void {
		this.eventListeners.get(event)?.delete(callback as EventCallback<keyof HotTakesHostEvents>);
	}

	/**
	 * Get peer ID for a player
	 */
	getPeerIdForPlayer(playerId: PlayerId): string | null {
		return this.peerManager.getPeerIdForPlayer(playerId);
	}

	// === Private Methods ===

	private setupPeerEvents(): void {
		this.peerManager.on('connection', (peerId, _conn) => {
			logger.debug`New connection from ${peerId}`;
		});

		this.peerManager.on('message', (peerId, message) => {
			this.handleMessage(peerId, message as HotTakesMessage);
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

	private handleMessage(peerId: string, message: HotTakesMessage): void {
		switch (message.type) {
			case 'player-join-request':
				this.handleJoinRequest(peerId, message as PlayerJoinRequestMessage);
				break;

			case 'player-update':
				this.handlePlayerUpdate(peerId, message as PlayerUpdateMessage);
				break;

			case 'take-submitted':
				this.handleTakeSubmitted(message as TakeSubmittedMessage);
				break;

			case 'vote-submitted':
				this.handleVoteSubmitted(message as VoteSubmittedMessage);
				break;

			case 'guess-submitted':
				this.handleGuessSubmitted(message as GuessSubmittedMessage);
				break;

			case 'player-reconnected':
				this.handlePlayerReconnected(peerId, message);
				break;

			default:
				logger.warn`Host received unexpected message type: ${message.type}`;
		}
	}

	private handleJoinRequest(peerId: string, message: PlayerJoinRequestMessage): void {
		const { playerName, playerEmoji } = message;

		const accept = (playerId: PlayerId) => {
			this.peerManager.setPlayerIdForPeer(peerId, playerId);
		};

		const reject = (reason: JoinRejectionReason) => {
			const rejectMessage = {
				...createBaseMessage('player-join-rejected', this.hostPlayerId),
				type: 'player-join-rejected' as const,
				reason,
			};
			this.peerManager.send(peerId, rejectMessage);
			this.peerManager.disconnectPeer(peerId);
		};

		this.emit('playerJoinRequest', peerId, playerName, playerEmoji, accept, reject);
	}

	private handlePlayerUpdate(peerId: string, message: PlayerUpdateMessage): void {
		const playerId = this.peerManager.getPlayerIdForPeer(peerId);
		if (!playerId) return;

		this.emit('playerUpdate', playerId, message.updates);
	}

	private handleTakeSubmitted(message: TakeSubmittedMessage): void {
		this.emit('takeSubmitted', message.playerId, message.take);
	}

	private handleVoteSubmitted(message: VoteSubmittedMessage): void {
		this.emit('voteReceived', message.vote);
	}

	private handleGuessSubmitted(message: GuessSubmittedMessage): void {
		this.emit('guessReceived', message.guess);
	}

	private handlePlayerReconnected(peerId: string, message: HotTakesMessage): void {
		const playerId = (message as { playerId: PlayerId }).playerId;
		this.peerManager.setPlayerIdForPeer(peerId, playerId);
		this.emit('playerReconnected', playerId);
	}

	private emit<K extends keyof HotTakesHostEvents>(
		event: K,
		...args: Parameters<HotTakesHostEvents[K]>
	): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			for (const callback of listeners) {
				try {
					(callback as (...args: Parameters<HotTakesHostEvents[K]>) => void)(...args);
				} catch (error) {
					logger.error`Error in event listener for ${event}: ${error}`;
				}
			}
		}
	}
}
