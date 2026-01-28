/**
 * Hot Takes round management
 */

import type { HotTake, TakeResult, HotTakesGameState, CurrentRound, Vote } from './types.js';
import { calculateAgreePercent, isControversial } from './scoring.js';

/**
 * Seeded random number generator for deterministic shuffling in tests
 */
let randomSeed: number | null = null;

/**
 * Set the random seed for deterministic shuffling
 */
export function setRandomSeed(seed: number): void {
	randomSeed = seed;
}

/**
 * Clear the random seed to use true randomness
 */
export function clearRandomSeed(): void {
	randomSeed = null;
}

/**
 * Get a random number (seeded or true random)
 */
function getRandom(): number {
	if (randomSeed !== null) {
		// Simple LCG for seeded random
		randomSeed = (randomSeed * 1664525 + 1013904223) % 4294967296;
		return randomSeed / 4294967296;
	}
	return Math.random();
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(getRandom() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

/**
 * Shuffle takes for gameplay (randomize order)
 */
export function shuffleTakes(takes: HotTake[]): HotTake[] {
	return shuffleArray(takes);
}

/**
 * Get the current take being processed (with author hidden)
 */
export function getCurrentTake(state: HotTakesGameState): Omit<HotTake, 'authorId'> | null {
	if (!state.currentRound || state.currentRound.takeIndex >= state.takes.length) {
		return null;
	}

	const take = state.takes[state.currentRound.takeIndex];
	return {
		id: take.id,
		text: take.text,
	};
}

/**
 * Get the full current take (including author, for host use)
 */
export function getCurrentTakeFull(state: HotTakesGameState): HotTake | null {
	if (!state.currentRound || state.currentRound.takeIndex >= state.takes.length) {
		return null;
	}
	return state.takes[state.currentRound.takeIndex];
}

/**
 * Create initial round state for starting the game
 */
export function createInitialRound(): CurrentRound {
	return {
		takeIndex: 0,
		currentTake: null,
		phaseStartTime: Date.now(),
		votes: [],
		guesses: [],
	};
}

/**
 * Set the current take for a round
 */
export function setCurrentTake(round: CurrentRound, take: Omit<HotTake, 'authorId'>): CurrentRound {
	return {
		...round,
		currentTake: take,
		phaseStartTime: Date.now(),
	};
}

/**
 * Advance to the next take
 * Returns the updated round state, or null if all takes are done
 */
export function advanceToNextTake(state: HotTakesGameState): CurrentRound | null {
	if (!state.currentRound) return null;

	const nextIndex = state.currentRound.takeIndex + 1;

	if (nextIndex >= state.takes.length) {
		return null; // All takes processed
	}

	const nextTake = state.takes[nextIndex];

	return {
		takeIndex: nextIndex,
		currentTake: {
			id: nextTake.id,
			text: nextTake.text,
		},
		phaseStartTime: Date.now(),
		votes: [],
		guesses: [],
	};
}

/**
 * Check if there are more takes to process
 */
export function hasMoreTakes(state: HotTakesGameState): boolean {
	if (!state.currentRound) return state.takes.length > 0;
	return state.currentRound.takeIndex + 1 < state.takes.length;
}

/**
 * Get take progress (current / total)
 */
export function getTakeProgress(state: HotTakesGameState): { current: number; total: number } {
	if (!state.currentRound) {
		return { current: 0, total: state.takes.length };
	}
	return {
		current: state.currentRound.takeIndex + 1,
		total: state.takes.length,
	};
}

/**
 * Create a take result from current round data
 */
export function createTakeResult(state: HotTakesGameState): TakeResult | null {
	if (!state.currentRound || !state.currentRound.currentTake) return null;

	const takeId = state.currentRound.currentTake.id;
	const take = state.takes.find((t) => t.id === takeId);
	if (!take) return null;

	const votes = state.currentRound.votes.filter((v) => v.takeId === takeId);
	const guesses = state.currentRound.guesses.filter((g) => g.takeId === takeId);
	const agreePercent = calculateAgreePercent(votes);

	return {
		takeId,
		authorId: take.authorId,
		votes,
		guesses,
		agreePercent,
		isControversial: isControversial(agreePercent),
	};
}

/**
 * Reveal the author of a take (get full take data)
 */
export function revealAuthor(
	state: HotTakesGameState,
	takeId: string
): { take: HotTake; authorName: string; authorEmoji: string } | null {
	const take = state.takes.find((t) => t.id === takeId);
	if (!take) return null;

	const author = state.players.find((p) => p.id === take.authorId);
	if (!author) return null;

	return {
		take,
		authorName: author.name,
		authorEmoji: author.emoji,
	};
}

/**
 * Get vote breakdown for display
 */
export function getVoteBreakdown(votes: Vote[]): {
	agreeCount: number;
	disagreeCount: number;
	agreePercent: number;
	disagreePercent: number;
} {
	const agreeCount = votes.filter((v) => v.vote === 'agree').length;
	const disagreeCount = votes.filter((v) => v.vote === 'disagree').length;
	const total = votes.length;

	return {
		agreeCount,
		disagreeCount,
		agreePercent: total > 0 ? Math.round((agreeCount / total) * 100) : 50,
		disagreePercent: total > 0 ? Math.round((disagreeCount / total) * 100) : 50,
	};
}
