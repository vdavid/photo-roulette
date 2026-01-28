/**
 * Core game types for Photo Roulette
 */

/** Unique identifier for a player */
export type PlayerId = string;

/** Unique identifier for a photo */
export type PhotoId = string;

/** Animal emoji used for player identification */
export type AnimalEmoji = string;

/** A player in the game */
export interface Player {
	id: PlayerId;
	name: string;
	emoji: AnimalEmoji;
	photoIds: PhotoId[];
	isHost: boolean;
	isReady: boolean;
	isConnected: boolean;
}

/** A photo from a player's collection */
export interface Photo {
	id: PhotoId;
	ownerId: PlayerId;
	baseUrl: string;
}

/** A player's guess for a round */
export interface Guess {
	playerId: PlayerId;
	guessedOwnerId: PlayerId;
	timestamp: number;
}

/** Score breakdown for a single player in a round */
export interface RoundPlayerScore {
	playerId: PlayerId;
	correctGuess: boolean;
	isFastest: boolean;
	isFeatured: boolean;
	points: number;
}

/** Result of a completed round */
export interface RoundResult {
	roundNumber: number;
	photoId: PhotoId;
	photoOwnerId: PlayerId;
	guesses: Guess[];
	scores: RoundPlayerScore[];
	fastestCorrectGuesserId: PlayerId | null;
}

/** Current state of a round in progress */
export interface Round {
	roundNumber: number;
	photoId: PhotoId;
	photoOwnerId: PlayerId;
	guesses: Guess[];
	startTime: number;
}

/** Game phases */
export type GamePhase = 'landing' | 'lobby' | 'playing' | 'results' | 'final';

/** Game settings configured by the host */
export interface GameSettings {
	totalRounds: number;
	timerSeconds: number;
}

/** Cumulative score for a player across all rounds */
export interface PlayerScore {
	playerId: PlayerId;
	totalPoints: number;
	correctGuesses: number;
	fastestGuesses: number;
	timesFeatured: number;
}

/** Photo pool for managing which photos have been used */
export interface PhotoPool {
	available: Photo[];
	used: Photo[];
}

/** Complete game state */
export interface GameState {
	phase: GamePhase;
	settings: GameSettings;
	players: Player[];
	photoPool: PhotoPool;
	currentRound: Round | null;
	roundResults: RoundResult[];
	playerScores: Map<PlayerId, PlayerScore>;
}

/** Superlative award types */
export type SuperlativeType = 'fastestFingers' | 'mostFeatured' | 'luckyGuesser' | 'sharpshooter';

/** A superlative award given at the end of the game */
export interface Superlative {
	type: SuperlativeType;
	playerId: PlayerId;
	label: string;
	description: string;
	value: number | string;
}

/** Final game results */
export interface FinalResults {
	rankings: PlayerScore[];
	superlatives: Superlative[];
	winnerId: PlayerId;
}
