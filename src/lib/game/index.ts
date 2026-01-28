/**
 * Game logic module for Photo Roulette
 *
 * This module contains all the core game logic as pure TypeScript functions,
 * designed to be independent of UI frameworks and networking.
 */

// Types
export type {
	PlayerId,
	PhotoId,
	AnimalEmoji,
	Player,
	Photo,
	Guess,
	RoundPlayerScore,
	RoundResult,
	Round,
	GamePhase,
	GameSettings,
	PlayerScore,
	PhotoPool,
	GameState,
	SuperlativeType,
	Superlative,
	FinalResults,
} from './types.js';

// Constants
export {
	POINTS_CORRECT_GUESS,
	POINTS_FASTEST_BONUS,
	POINTS_FEATURED,
	TIMER_OPTIONS,
	DEFAULT_TIMER_SECONDS,
	BLUR_REVEAL_DURATION_MS,
	ROUND_RESULT_DISPLAY_MS,
	ROUND_OPTIONS,
	DEFAULT_ROUNDS,
	MAX_PLAYERS,
	MIN_PHOTOS_PER_PLAYER,
	DEFAULT_GAME_SETTINGS,
	ANIMAL_EMOJIS,
	PHOTO_URL_VALIDITY_MINUTES,
} from './constants.js';

// Scoring
export {
	findFastestCorrectGuesser,
	calculateRoundScores,
	createEmptyPlayerScore,
	calculateFinalScores,
	getRankedScores,
	determineWinner,
} from './scoring.js';

// Round management
export {
	createPhotoPool,
	selectRandomPhoto,
	shuffleArray,
	createRound,
	addGuess,
	updateGuess,
	completeRound,
	allPlayersGuessed,
	getGuessCount,
	hasPlayerGuessed,
	getPlayerGuess,
} from './round.js';

// State machine
export {
	isValidTransition,
	createInitialState,
	transitionToLobby,
	addPlayer,
	removePlayer,
	updatePlayer,
	updateSettings,
	isPlayerReady,
	allPlayersReady,
	transitionToPlaying,
	transitionToResults,
	advanceFromResults,
	transitionToFinal,
	startRematch,
	transitionToNewGame,
	getCurrentRoundNumber,
	isGameActive,
} from './state.js';

// Superlatives
export {
	calculatePlayerStats,
	findFastestFingers,
	findMostFeatured,
	findSharpshooter,
	findLuckyGuesser,
	formatAccuracy,
	calculateSuperlatives,
	getSuperlativeByType,
} from './superlatives.js';

// Random (for deterministic testing)
export {
	setRandomSeed,
	getRandomSeed,
	resetRandom,
	random,
	randomInt,
	randomElement,
} from './random.js';
