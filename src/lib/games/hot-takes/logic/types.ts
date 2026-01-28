/**
 * Hot Takes game types
 */

import type { PlayerId } from '$lib/common/networking/types.js';

/** A hot take (controversial opinion) */
export interface HotTake {
	/** Unique identifier */
	id: string;
	/** The text content of the hot take */
	text: string;
	/** Player who wrote this take (hidden until reveal) */
	authorId: PlayerId;
}

/** A player's vote on a hot take */
export interface Vote {
	/** Player who cast this vote */
	playerId: PlayerId;
	/** The take being voted on */
	takeId: string;
	/** The vote value */
	vote: 'agree' | 'disagree';
}

/** A player's guess about who wrote a hot take */
export interface Guess {
	/** Player who made this guess */
	playerId: PlayerId;
	/** The take being guessed */
	takeId: string;
	/** The guessed author */
	guessedAuthorId: PlayerId;
}

/** Result data for a single hot take after voting and guessing */
export interface TakeResult {
	/** The take ID */
	takeId: string;
	/** The actual author */
	authorId: PlayerId;
	/** All votes cast for this take */
	votes: Vote[];
	/** All guesses made for this take */
	guesses: Guess[];
	/** Percentage who agreed (0-100) */
	agreePercent: number;
	/** Whether this take was controversial (40-60% split) */
	isControversial: boolean;
}

/** Game phases */
export type HotTakesPhase = 'lobby' | 'submitting' | 'voting' | 'guessing' | 'reveal' | 'final';

/** Game settings */
export interface HotTakesSettings {
	/** Number of takes each player must submit (1-3) */
	takesPerPlayer: 1 | 2 | 3;
	/** Time in seconds for voting on each take */
	votingTimeSeconds: 10 | 15 | 20 | 30;
	/** Time in seconds for guessing on each take */
	guessingTimeSeconds: 15 | 20 | 30 | 45;
}

/** Default game settings */
export const DEFAULT_HOT_TAKES_SETTINGS: HotTakesSettings = {
	takesPerPlayer: 2,
	votingTimeSeconds: 15,
	guessingTimeSeconds: 20,
};

/** Player score tracking */
export interface PlayerScore {
	/** Total points accumulated */
	totalPoints: number;
	/** Number of correct guesses */
	correctGuesses: number;
	/** Number of controversial takes (40-60% split) */
	controversialTakes: number;
}

/** Player in Hot Takes game */
export interface HotTakesPlayer {
	/** Unique identifier */
	id: PlayerId;
	/** Display name */
	name: string;
	/** Emoji avatar */
	emoji: string;
	/** Whether player is ready to start */
	isReady: boolean;
	/** Whether player is a spectator */
	isSpectator: boolean;
	/** IDs of takes this player has submitted */
	takeIds: string[];
	/** Whether player is currently connected */
	isConnected: boolean;
}

/** Current round state (voting or guessing on a single take) */
export interface CurrentRound {
	/** Index of current take being processed */
	takeIndex: number;
	/** The current take (with author hidden during voting/guessing) */
	currentTake: Omit<HotTake, 'authorId'> | null;
	/** Start timestamp for the current phase timer */
	phaseStartTime: number;
	/** Votes collected for current take */
	votes: Vote[];
	/** Guesses collected for current take */
	guesses: Guess[];
}

/** Complete game state */
export interface HotTakesGameState {
	/** Current game phase */
	phase: HotTakesPhase;
	/** Game settings */
	settings: HotTakesSettings;
	/** All players in the game */
	players: HotTakesPlayer[];
	/** All submitted hot takes (shuffled, authors hidden until reveal) */
	takes: HotTake[];
	/** Current round state */
	currentRound: CurrentRound | null;
	/** Results for completed takes */
	takeResults: TakeResult[];
	/** Player scores */
	playerScores: Map<PlayerId, PlayerScore>;
}

/** Final game results */
export interface FinalResults {
	/** Player rankings sorted by score (highest first) */
	rankings: Array<{
		playerId: PlayerId;
		playerName: string;
		playerEmoji: string;
		score: PlayerScore;
		rank: number;
	}>;
	/** Most controversial take */
	mostControversialTake: TakeResult | null;
	/** Most agreed-with take */
	mostAgreedTake: TakeResult | null;
	/** Most disagreed-with take */
	mostDisagreedTake: TakeResult | null;
	/** All take results for review */
	allResults: TakeResult[];
}
