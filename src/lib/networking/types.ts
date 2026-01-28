/**
 * Network message types for P2P communication
 */

import type {
	PlayerId,
	Player,
	Photo,
	GameSettings,
	GamePhase,
	Round,
	RoundResult,
	Guess,
	PlayerScore,
	FinalResults,
} from '$lib/game';

// === Message Types ===

/** All possible message types */
export type MessageType =
	// Connection
	| 'player-join-request'
	| 'player-join-accepted'
	| 'player-join-rejected'
	| 'player-left'
	| 'player-reconnected'
	| 'player-kicked'
	// Lobby
	| 'player-update'
	| 'photos-submitted'
	| 'settings-changed'
	| 'game-starting'
	// Game
	| 'round-start'
	| 'guess-submitted'
	| 'round-end'
	| 'game-end'
	// State sync
	| 'state-sync'
	| 'ping'
	| 'pong';

/** Base message structure */
export interface BaseMessage {
	type: MessageType;
	timestamp: number;
	senderId: PlayerId;
}

// === Connection Messages ===

/** Player requesting to join a game */
export interface PlayerJoinRequestMessage extends BaseMessage {
	type: 'player-join-request';
	playerName: string;
	playerEmoji: string;
}

/** Host accepting a player's join request */
export interface PlayerJoinAcceptedMessage extends BaseMessage {
	type: 'player-join-accepted';
	playerId: PlayerId;
	players: Player[];
	settings: GameSettings;
	phase: GamePhase;
}

/** Host rejecting a player's join request */
export interface PlayerJoinRejectedMessage extends BaseMessage {
	type: 'player-join-rejected';
	reason: 'game-full' | 'game-in-progress' | 'name-taken' | 'invalid-room';
}

/** Player leaving the game */
export interface PlayerLeftMessage extends BaseMessage {
	type: 'player-left';
	playerId: PlayerId;
}

/** Player reconnecting to the game */
export interface PlayerReconnectedMessage extends BaseMessage {
	type: 'player-reconnected';
	playerId: PlayerId;
}

/** Host kicking a player */
export interface PlayerKickedMessage extends BaseMessage {
	type: 'player-kicked';
	playerId: PlayerId;
	reason?: string;
}

// === Lobby Messages ===

/** Player updating their info (name, emoji, ready state, spectator mode, photoIds) */
export interface PlayerUpdateMessage extends BaseMessage {
	type: 'player-update';
	playerId: PlayerId;
	updates: Partial<Pick<Player, 'name' | 'emoji' | 'isReady' | 'isSpectator' | 'photoIds'>>;
}

/** Player submitting their photos */
export interface PhotosSubmittedMessage extends BaseMessage {
	type: 'photos-submitted';
	playerId: PlayerId;
	photos: Photo[];
}

/** Host changing game settings */
export interface SettingsChangedMessage extends BaseMessage {
	type: 'settings-changed';
	settings: GameSettings;
}

/** Host starting the game */
export interface GameStartingMessage extends BaseMessage {
	type: 'game-starting';
	players: Player[];
	settings: GameSettings;
}

// === Game Messages ===

/** A new round is starting */
export interface RoundStartMessage extends BaseMessage {
	type: 'round-start';
	roundNumber: number;
	/** Base64 encoded JPEG image data (without data URL prefix) */
	imageData: string;
	photoId: string;
	startTime: number;
}

/** Player submitting a guess */
export interface GuessSubmittedMessage extends BaseMessage {
	type: 'guess-submitted';
	guess: Guess;
}

/** Round has ended, results available */
export interface RoundEndMessage extends BaseMessage {
	type: 'round-end';
	result: RoundResult;
	currentScores: PlayerScoreData[];
}

/** Serializable version of PlayerScore (Map can't be serialized) */
export interface PlayerScoreData {
	playerId: PlayerId;
	totalPoints: number;
	correctGuesses: number;
	fastestGuesses: number;
	timesFeatured: number;
}

/** Game has ended */
export interface GameEndMessage extends BaseMessage {
	type: 'game-end';
	finalResults: FinalResults;
}

// === State Sync Messages ===

/** Full state synchronization (for reconnects) */
export interface StateSyncMessage extends BaseMessage {
	type: 'state-sync';
	phase: GamePhase;
	settings: GameSettings;
	players: Player[];
	currentRound: Round | null;
	roundResults: RoundResult[];
	playerScores: PlayerScoreData[];
}

/** Ping message for connection health check */
export interface PingMessage extends BaseMessage {
	type: 'ping';
}

/** Pong response to ping */
export interface PongMessage extends BaseMessage {
	type: 'pong';
}

// === Union Type ===

/** All possible messages */
export type NetworkMessage =
	| PlayerJoinRequestMessage
	| PlayerJoinAcceptedMessage
	| PlayerJoinRejectedMessage
	| PlayerLeftMessage
	| PlayerReconnectedMessage
	| PlayerKickedMessage
	| PlayerUpdateMessage
	| PhotosSubmittedMessage
	| SettingsChangedMessage
	| GameStartingMessage
	| RoundStartMessage
	| GuessSubmittedMessage
	| RoundEndMessage
	| GameEndMessage
	| StateSyncMessage
	| PingMessage
	| PongMessage;

// === Connection State ===

/** State of a peer connection */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Information about a connected peer */
export interface PeerConnection {
	peerId: string;
	playerId: PlayerId;
	state: ConnectionState;
	lastPingTime: number | null;
	latency: number | null;
}

/** Network role */
export type NetworkRole = 'host' | 'player' | 'none';

/** Network status */
export interface NetworkStatus {
	role: NetworkRole;
	roomCode: string | null;
	isConnected: boolean;
	connections: PeerConnection[];
	error: string | null;
}

// === Helper Functions ===

/** Create a base message with common fields */
export function createBaseMessage(type: MessageType, senderId: PlayerId): BaseMessage {
	return {
		type,
		timestamp: Date.now(),
		senderId,
	};
}

/** Convert PlayerScore Map to serializable array */
export function playerScoresToData(scores: Map<PlayerId, PlayerScore>): PlayerScoreData[] {
	return Array.from(scores.values()).map((score) => ({
		playerId: score.playerId,
		totalPoints: score.totalPoints,
		correctGuesses: score.correctGuesses,
		fastestGuesses: score.fastestGuesses,
		timesFeatured: score.timesFeatured,
	}));
}

/** Convert serialized scores back to Map */
export function dataToPlayerScores(data: PlayerScoreData[]): Map<PlayerId, PlayerScore> {
	const map = new Map<PlayerId, PlayerScore>();
	for (const score of data) {
		map.set(score.playerId, score);
	}
	return map;
}
