/**
 * Hot Takes networking message types
 */

import type { PlayerId, BaseMessage } from '$lib/common/networking/types.js';
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

// ============================================
// Player -> Host Messages
// ============================================

/** Player join request */
export interface PlayerJoinRequestMessage extends BaseMessage {
	type: 'player-join-request';
	playerName: string;
	playerEmoji: string;
}

/** Player submits a hot take */
export interface TakeSubmittedMessage extends BaseMessage {
	type: 'take-submitted';
	playerId: PlayerId;
	take: { id: string; text: string };
}

/** Player submits a vote */
export interface VoteSubmittedMessage extends BaseMessage {
	type: 'vote-submitted';
	vote: Vote;
}

/** Player submits a guess */
export interface GuessSubmittedMessage extends BaseMessage {
	type: 'guess-submitted';
	guess: Guess;
}

/** Player update (name, emoji, ready state, spectator) */
export interface PlayerUpdateMessage extends BaseMessage {
	type: 'player-update';
	playerId: PlayerId;
	updates: Partial<Pick<HotTakesPlayer, 'name' | 'emoji' | 'isReady' | 'isSpectator'>>;
}

// ============================================
// Host -> Player Messages
// ============================================

/** Join accepted response */
export interface PlayerJoinAcceptedMessage extends BaseMessage {
	type: 'player-join-accepted';
	playerId: PlayerId;
	players: HotTakesPlayer[];
	settings: HotTakesSettings;
	phase: HotTakesPhase;
}

/** All takes have been submitted, game can proceed */
export interface AllTakesReadyMessage extends BaseMessage {
	type: 'all-takes-ready';
	totalTakes: number;
}

/** Voting started for a take */
export interface VotingStartMessage extends BaseMessage {
	type: 'voting-start';
	take: Omit<HotTake, 'authorId'>;
	takeIndex: number;
	totalTakes: number;
	startTime: number;
	votingTimeSeconds: number;
}

/** Voting ended for a take */
export interface VotingEndMessage extends BaseMessage {
	type: 'voting-end';
	takeId: string;
	votes: Vote[];
	agreePercent: number;
}

/** Guessing started for a take */
export interface GuessingStartMessage extends BaseMessage {
	type: 'guessing-start';
	takeId: string;
	votes: Vote[];
	agreePercent: number;
	startTime: number;
	guessingTimeSeconds: number;
}

/** Guessing ended for a take */
export interface GuessingEndMessage extends BaseMessage {
	type: 'guessing-end';
	takeId: string;
}

/** Take author revealed with results */
export interface TakeRevealMessage extends BaseMessage {
	type: 'take-reveal';
	result: TakeResult;
	authorName: string;
	authorEmoji: string;
	currentScores: PlayerScoreData[];
}

/** Game ended with final results */
export interface GameEndMessage extends BaseMessage {
	type: 'game-end';
	finalResults: FinalResults;
}

/** Settings changed */
export interface SettingsChangedMessage extends BaseMessage {
	type: 'settings-changed';
	settings: HotTakesSettings;
}

/** Game is starting (leaving lobby) */
export interface GameStartingMessage extends BaseMessage {
	type: 'game-starting';
	players: HotTakesPlayer[];
	settings: HotTakesSettings;
}

/** Player left notification */
export interface PlayerLeftMessage extends BaseMessage {
	type: 'player-left';
	playerId: PlayerId;
}

/** Full state sync (for reconnection) */
export interface StateSyncMessage extends BaseMessage {
	type: 'state-sync';
	phase: HotTakesPhase;
	settings: HotTakesSettings;
	players: HotTakesPlayer[];
	currentRound: CurrentRound | null;
	takeResults: TakeResult[];
	playerScores: PlayerScoreData[];
}

// ============================================
// Serialization helpers (for Map<PlayerId, PlayerScore>)
// ============================================

/** Serializable player score data */
export interface PlayerScoreData {
	playerId: PlayerId;
	score: PlayerScore;
}

/** Convert Map to serializable array */
export function playerScoresToData(scores: Map<PlayerId, PlayerScore>): PlayerScoreData[] {
	return Array.from(scores.entries()).map(([playerId, score]) => ({
		playerId,
		score,
	}));
}

/** Convert serializable array back to Map */
export function dataToPlayerScores(data: PlayerScoreData[]): Map<PlayerId, PlayerScore> {
	return new Map(data.map((d) => [d.playerId, d.score]));
}

// ============================================
// Union type for all Hot Takes messages
// ============================================

export type HotTakesMessage =
	// Player -> Host
	| PlayerJoinRequestMessage
	| TakeSubmittedMessage
	| VoteSubmittedMessage
	| GuessSubmittedMessage
	| PlayerUpdateMessage
	// Host -> Player
	| PlayerJoinAcceptedMessage
	| AllTakesReadyMessage
	| VotingStartMessage
	| VotingEndMessage
	| GuessingStartMessage
	| GuessingEndMessage
	| TakeRevealMessage
	| GameEndMessage
	| SettingsChangedMessage
	| GameStartingMessage
	| PlayerLeftMessage
	| StateSyncMessage
	// Common types from base
	| { type: 'ping'; timestamp: number }
	| { type: 'pong'; timestamp: number }
	| { type: 'player-join-rejected'; reason: string }
	| { type: 'player-kicked'; playerId: PlayerId; reason?: string }
	| { type: 'player-reconnected'; playerId: PlayerId };

// ============================================
// Type guards
// ============================================

export function isPlayerJoinRequest(msg: HotTakesMessage): msg is PlayerJoinRequestMessage {
	return msg.type === 'player-join-request';
}

export function isTakeSubmitted(msg: HotTakesMessage): msg is TakeSubmittedMessage {
	return msg.type === 'take-submitted';
}

export function isVoteSubmitted(msg: HotTakesMessage): msg is VoteSubmittedMessage {
	return msg.type === 'vote-submitted';
}

export function isGuessSubmitted(msg: HotTakesMessage): msg is GuessSubmittedMessage {
	return msg.type === 'guess-submitted';
}

export function isPlayerUpdate(msg: HotTakesMessage): msg is PlayerUpdateMessage {
	return msg.type === 'player-update';
}

export function isVotingStart(msg: HotTakesMessage): msg is VotingStartMessage {
	return msg.type === 'voting-start';
}

export function isGuessingStart(msg: HotTakesMessage): msg is GuessingStartMessage {
	return msg.type === 'guessing-start';
}

export function isTakeReveal(msg: HotTakesMessage): msg is TakeRevealMessage {
	return msg.type === 'take-reveal';
}

export function isGameEnd(msg: HotTakesMessage): msg is GameEndMessage {
	return msg.type === 'game-end';
}
