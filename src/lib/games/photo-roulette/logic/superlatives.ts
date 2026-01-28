/**
 * Superlatives calculation for Photo Roulette
 *
 * Awards given at the end of the game based on player performance.
 */

import type { Superlative, SuperlativeType, RoundResult, PlayerId } from './types.js';

interface PlayerStats {
	playerId: PlayerId;
	correctGuesses: number;
	totalGuesses: number;
	fastestGuesses: number;
	timesFeatured: number;
	accuracy: number;
}

/**
 * Calculate detailed stats for each player from round results
 */
export function calculatePlayerStats(
	playerIds: PlayerId[],
	roundResults: RoundResult[]
): Map<PlayerId, PlayerStats> {
	const stats = new Map<PlayerId, PlayerStats>();

	// Initialize stats
	for (const playerId of playerIds) {
		stats.set(playerId, {
			playerId,
			correctGuesses: 0,
			totalGuesses: 0,
			fastestGuesses: 0,
			timesFeatured: 0,
			accuracy: 0,
		});
	}

	// Accumulate from round results
	for (const round of roundResults) {
		for (const score of round.scores) {
			const playerStats = stats.get(score.playerId);
			if (!playerStats) continue;

			// Check if player submitted a guess this round
			const playerGuessed = round.guesses.some((g) => g.playerId === score.playerId);

			if (playerGuessed) {
				playerStats.totalGuesses++;
				if (score.correctGuess) {
					playerStats.correctGuesses++;
				}
			}

			if (score.isFastest) {
				playerStats.fastestGuesses++;
			}

			if (score.isFeatured) {
				playerStats.timesFeatured++;
			}
		}
	}

	// Calculate accuracy
	for (const playerStats of stats.values()) {
		playerStats.accuracy =
			playerStats.totalGuesses > 0 ? playerStats.correctGuesses / playerStats.totalGuesses : 0;
	}

	return stats;
}

/**
 * Find the player with the most fastest correct guesses
 */
export function findFastestFingers(
	stats: Map<PlayerId, PlayerStats>
): { playerId: PlayerId; count: number } | null {
	let best: { playerId: PlayerId; count: number } | null = null;

	for (const playerStats of stats.values()) {
		if (playerStats.fastestGuesses > 0 && (!best || playerStats.fastestGuesses > best.count)) {
			best = {
				playerId: playerStats.playerId,
				count: playerStats.fastestGuesses,
			};
		}
	}

	return best;
}

/**
 * Find the player whose photos were featured most often
 */
export function findMostFeatured(
	stats: Map<PlayerId, PlayerStats>
): { playerId: PlayerId; count: number } | null {
	let best: { playerId: PlayerId; count: number } | null = null;

	for (const playerStats of stats.values()) {
		if (playerStats.timesFeatured > 0 && (!best || playerStats.timesFeatured > best.count)) {
			best = {
				playerId: playerStats.playerId,
				count: playerStats.timesFeatured,
			};
		}
	}

	return best;
}

/**
 * Find the sharpshooter (highest accuracy with minimum 3 guesses)
 */
export function findSharpshooter(
	stats: Map<PlayerId, PlayerStats>,
	minGuesses: number = 3
): { playerId: PlayerId; accuracy: number } | null {
	let best: { playerId: PlayerId; accuracy: number } | null = null;

	for (const playerStats of stats.values()) {
		if (
			playerStats.totalGuesses >= minGuesses &&
			playerStats.accuracy > 0 &&
			(!best || playerStats.accuracy > best.accuracy)
		) {
			best = {
				playerId: playerStats.playerId,
				accuracy: playerStats.accuracy,
			};
		}
	}

	return best;
}

/**
 * Find the lucky guesser (lower accuracy but still got some correct)
 * This is the player with the lowest accuracy among those who got at least 1 correct
 */
export function findLuckyGuesser(
	stats: Map<PlayerId, PlayerStats>,
	minGuesses: number = 3
): { playerId: PlayerId; accuracy: number } | null {
	let best: { playerId: PlayerId; accuracy: number } | null = null;

	for (const playerStats of stats.values()) {
		if (
			playerStats.totalGuesses >= minGuesses &&
			playerStats.correctGuesses > 0 &&
			(!best || playerStats.accuracy < best.accuracy)
		) {
			best = {
				playerId: playerStats.playerId,
				accuracy: playerStats.accuracy,
			};
		}
	}

	return best;
}

/**
 * Format accuracy as percentage string
 */
export function formatAccuracy(accuracy: number): string {
	return `${Math.round(accuracy * 100)}%`;
}

/**
 * Calculate all superlatives for end-game display
 */
export function calculateSuperlatives(
	playerIds: PlayerId[],
	roundResults: RoundResult[],
	playerNames: Map<PlayerId, string>
): Superlative[] {
	const stats = calculatePlayerStats(playerIds, roundResults);
	const superlatives: Superlative[] = [];

	// Fastest fingers
	const fastestFingers = findFastestFingers(stats);
	if (fastestFingers) {
		superlatives.push({
			type: 'fastestFingers',
			playerId: fastestFingers.playerId,
			label: 'Fastest fingers',
			description: playerNames.get(fastestFingers.playerId) || fastestFingers.playerId,
			value: `${fastestFingers.count} times`,
		});
	}

	// Most featured
	const mostFeatured = findMostFeatured(stats);
	if (mostFeatured) {
		superlatives.push({
			type: 'mostFeatured',
			playerId: mostFeatured.playerId,
			label: 'Most featured',
			description: playerNames.get(mostFeatured.playerId) || mostFeatured.playerId,
			value: `${mostFeatured.count} photos`,
		});
	}

	// Sharpshooter (highest accuracy)
	const sharpshooter = findSharpshooter(stats);
	if (sharpshooter) {
		superlatives.push({
			type: 'sharpshooter',
			playerId: sharpshooter.playerId,
			label: 'Sharpshooter',
			description: playerNames.get(sharpshooter.playerId) || sharpshooter.playerId,
			value: formatAccuracy(sharpshooter.accuracy),
		});
	}

	// Lucky guesser (lowest accuracy with correct guesses)
	const luckyGuesser = findLuckyGuesser(stats);
	// Only show if different from sharpshooter
	if (luckyGuesser && (!sharpshooter || luckyGuesser.playerId !== sharpshooter.playerId)) {
		superlatives.push({
			type: 'luckyGuesser',
			playerId: luckyGuesser.playerId,
			label: 'Lucky guesser',
			description: playerNames.get(luckyGuesser.playerId) || luckyGuesser.playerId,
			value: `${formatAccuracy(luckyGuesser.accuracy)} but clutch`,
		});
	}

	return superlatives;
}

/**
 * Get a specific superlative by type
 */
export function getSuperlativeByType(
	superlatives: Superlative[],
	type: SuperlativeType
): Superlative | undefined {
	return superlatives.find((s) => s.type === type);
}
