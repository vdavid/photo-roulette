/**
 * Photo Roulette specific network message types
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
} from '../logic/types.js';
import type {
	BaseMessage,
	PlayerJoinRequestMessage,
	PlayerJoinRejectedMessage,
	PlayerLeftMessage,
	PlayerReconnectedMessage,
	PlayerKickedMessage,
	PingMessage,
	PongMessage,
} from '$lib/common/networking/types.js';

// Re-export common message types
export type {
	PlayerJoinRequestMessage,
	PlayerJoinRejectedMessage,
	PlayerLeftMessage,
	PlayerReconnectedMessage,
	PlayerKickedMessage,
	PingMessage,
	PongMessage,
};

// === Photo Roulette Message Types ===

/** All possible message types for Photo Roulette */
export type PhotoRouletteMessageType =
	// Connection (from common)
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

// === Photo Roulette Specific Messages ===

/** Host accepting a player's join request */
export interface PlayerJoinAcceptedMessage extends BaseMessage {
	type: 'player-join-accepted';
	playerId: PlayerId;
	players: Player[];
	settings: GameSettings;
	phase: GamePhase;
}

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

/** Serializable version of PlayerScore (Map can't be serialized) */
export interface PlayerScoreData {
	playerId: PlayerId;
	totalPoints: number;
	correctGuesses: number;
	fastestGuesses: number;
	timesFeatured: number;
}

/** Round has ended, results available */
export interface RoundEndMessage extends BaseMessage {
	type: 'round-end';
	result: RoundResult;
	currentScores: PlayerScoreData[];
}

/** Game has ended */
export interface GameEndMessage extends BaseMessage {
	type: 'game-end';
	finalResults: FinalResults;
}

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

// === Union Type ===

/** All possible Photo Roulette messages */
export type PhotoRouletteMessage =
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

// === Helper Functions ===

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
