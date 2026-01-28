/**
 * Hot Takes game state management
 */

import type { PlayerId } from '$lib/common/networking/types.js';
import type {
	HotTakesPhase,
	HotTakesGameState,
	HotTakesSettings,
	HotTakesPlayer,
	Vote,
	Guess,
} from './types.js';
import { DEFAULT_HOT_TAKES_SETTINGS } from './types.js';

/**
 * Valid phase transitions
 */
const VALID_TRANSITIONS: Record<HotTakesPhase, HotTakesPhase[]> = {
	lobby: ['submitting'],
	submitting: ['voting'],
	voting: ['guessing'],
	guessing: ['reveal'],
	reveal: ['voting', 'final'], // Can go to next take (voting) or end (final)
	final: ['lobby'], // Can restart
};

/**
 * Create initial game state
 */
export function createInitialState(settings?: Partial<HotTakesSettings>): HotTakesGameState {
	return {
		phase: 'lobby',
		settings: { ...DEFAULT_HOT_TAKES_SETTINGS, ...settings },
		players: [],
		takes: [],
		currentRound: null,
		takeResults: [],
		playerScores: new Map(),
	};
}

/**
 * Check if a phase transition is valid
 */
export function isValidTransition(from: HotTakesPhase, to: HotTakesPhase): boolean {
	return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if all active players have submitted their takes
 */
export function allPlayersSubmitted(state: HotTakesGameState): boolean {
	const activePlayers = state.players.filter((p) => !p.isSpectator && p.isConnected);
	return activePlayers.every((p) => p.takeIds.length >= state.settings.takesPerPlayer);
}

/**
 * Check if all active players have voted on a take
 */
export function allPlayersVoted(state: HotTakesGameState, takeId: string): boolean {
	if (!state.currentRound) return false;

	const activePlayers = state.players.filter((p) => !p.isSpectator && p.isConnected);
	const votedPlayerIds = new Set(
		state.currentRound.votes.filter((v) => v.takeId === takeId).map((v) => v.playerId)
	);

	return activePlayers.every((p) => votedPlayerIds.has(p.id));
}

/**
 * Check if all active players have guessed on a take
 */
export function allPlayersGuessed(state: HotTakesGameState, takeId: string): boolean {
	if (!state.currentRound) return false;

	// Get active players excluding the author (they can't guess their own take)
	const currentTake = state.takes.find((t) => t.id === takeId);
	if (!currentTake) return false;

	const activePlayers = state.players.filter(
		(p) => !p.isSpectator && p.isConnected && p.id !== currentTake.authorId
	);

	const guessedPlayerIds = new Set(
		state.currentRound.guesses.filter((g) => g.takeId === takeId).map((g) => g.playerId)
	);

	return activePlayers.every((p) => guessedPlayerIds.has(p.id));
}

/**
 * Get number of players who have submitted all their takes
 */
export function getSubmissionCount(state: HotTakesGameState): {
	submitted: number;
	total: number;
} {
	const activePlayers = state.players.filter((p) => !p.isSpectator && p.isConnected);
	const submitted = activePlayers.filter(
		(p) => p.takeIds.length >= state.settings.takesPerPlayer
	).length;

	return { submitted, total: activePlayers.length };
}

/**
 * Get vote count for current take
 */
export function getVoteCount(state: HotTakesGameState): { voted: number; total: number } {
	if (!state.currentRound || !state.currentRound.currentTake) {
		return { voted: 0, total: 0 };
	}

	const activePlayers = state.players.filter((p) => !p.isSpectator && p.isConnected);
	const voted = state.currentRound.votes.filter(
		(v) => v.takeId === state.currentRound!.currentTake!.id
	).length;

	return { voted, total: activePlayers.length };
}

/**
 * Get guess count for current take
 */
export function getGuessCount(state: HotTakesGameState): { guessed: number; total: number } {
	if (!state.currentRound || !state.currentRound.currentTake) {
		return { guessed: 0, total: 0 };
	}

	const currentTake = state.takes.find((t) => t.id === state.currentRound!.currentTake!.id);
	if (!currentTake) return { guessed: 0, total: 0 };

	// Exclude the author from total (they can't guess their own take)
	const activePlayers = state.players.filter(
		(p) => !p.isSpectator && p.isConnected && p.id !== currentTake.authorId
	);

	const guessed = state.currentRound.guesses.filter(
		(g) => g.takeId === state.currentRound!.currentTake!.id
	).length;

	return { guessed, total: activePlayers.length };
}

/**
 * Check if a player has already voted on the current take
 */
export function hasPlayerVoted(state: HotTakesGameState, playerId: PlayerId): boolean {
	if (!state.currentRound || !state.currentRound.currentTake) return false;

	return state.currentRound.votes.some(
		(v) => v.playerId === playerId && v.takeId === state.currentRound!.currentTake!.id
	);
}

/**
 * Check if a player has already guessed on the current take
 */
export function hasPlayerGuessed(state: HotTakesGameState, playerId: PlayerId): boolean {
	if (!state.currentRound || !state.currentRound.currentTake) return false;

	return state.currentRound.guesses.some(
		(g) => g.playerId === playerId && g.takeId === state.currentRound!.currentTake!.id
	);
}

/**
 * Add a vote to the current round
 */
export function addVote(state: HotTakesGameState, vote: Vote): HotTakesGameState {
	if (!state.currentRound) return state;

	return {
		...state,
		currentRound: {
			...state.currentRound,
			votes: [...state.currentRound.votes, vote],
		},
	};
}

/**
 * Add a guess to the current round
 */
export function addGuess(state: HotTakesGameState, guess: Guess): HotTakesGameState {
	if (!state.currentRound) return state;

	return {
		...state,
		currentRound: {
			...state.currentRound,
			guesses: [...state.currentRound.guesses, guess],
		},
	};
}

/**
 * Get the number of active (non-spectator, connected) players
 */
export function getActivePlayerCount(state: HotTakesGameState): number {
	return state.players.filter((p) => !p.isSpectator && p.isConnected).length;
}

/**
 * Check if a player is the author of the current take
 */
export function isCurrentTakeAuthor(state: HotTakesGameState, playerId: PlayerId): boolean {
	if (!state.currentRound || !state.currentRound.currentTake) return false;

	const currentTake = state.takes.find((t) => t.id === state.currentRound!.currentTake!.id);
	return currentTake?.authorId === playerId;
}

/**
 * Update a player in the state
 */
export function updatePlayer(
	state: HotTakesGameState,
	playerId: PlayerId,
	updates: Partial<HotTakesPlayer>
): HotTakesGameState {
	return {
		...state,
		players: state.players.map((p) => (p.id === playerId ? { ...p, ...updates } : p)),
	};
}
