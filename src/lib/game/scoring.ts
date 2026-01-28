/**
 * Scoring logic for Photo Roulette
 */

import { POINTS_CORRECT_GUESS, POINTS_FASTEST_BONUS, POINTS_FEATURED } from './constants.js';
import type { Guess, PlayerId, PlayerScore, RoundPlayerScore, RoundResult } from './types.js';

/**
 * Find the player ID of the fastest correct guesser
 * In case of tie (same timestamp), the first one received wins
 */
export function findFastestCorrectGuesser(
	guesses: Guess[],
	correctOwnerId: PlayerId
): PlayerId | null {
	const correctGuesses = guesses.filter((g) => g.guessedOwnerId === correctOwnerId);

	if (correctGuesses.length === 0) {
		return null;
	}

	// Sort by timestamp ascending, first one wins ties
	const sorted = [...correctGuesses].sort((a, b) => a.timestamp - b.timestamp);
	return sorted[0].playerId;
}

/**
 * Calculate scores for a single round
 */
export function calculateRoundScores(
	playerIds: PlayerId[],
	guesses: Guess[],
	photoOwnerId: PlayerId
): RoundPlayerScore[] {
	const fastestGuesserId = findFastestCorrectGuesser(guesses, photoOwnerId);
	const guessMap = new Map(guesses.map((g) => [g.playerId, g]));

	return playerIds.map((playerId) => {
		const guess = guessMap.get(playerId);
		const correctGuess = guess?.guessedOwnerId === photoOwnerId;
		const isFastest = playerId === fastestGuesserId;
		const isFeatured = playerId === photoOwnerId;

		let points = 0;

		if (correctGuess) {
			points += POINTS_CORRECT_GUESS;
		}

		if (isFastest) {
			points += POINTS_FASTEST_BONUS;
		}

		if (isFeatured) {
			points += POINTS_FEATURED;
		}

		return {
			playerId,
			correctGuess,
			isFastest,
			isFeatured,
			points,
		};
	});
}

/**
 * Create an empty player score object
 */
export function createEmptyPlayerScore(playerId: PlayerId): PlayerScore {
	return {
		playerId,
		totalPoints: 0,
		correctGuesses: 0,
		fastestGuesses: 0,
		timesFeatured: 0,
	};
}

/**
 * Calculate cumulative scores across all rounds
 */
export function calculateFinalScores(
	playerIds: PlayerId[],
	roundResults: RoundResult[]
): Map<PlayerId, PlayerScore> {
	const scores = new Map<PlayerId, PlayerScore>();

	// Initialize scores for all players
	for (const playerId of playerIds) {
		scores.set(playerId, createEmptyPlayerScore(playerId));
	}

	// Accumulate scores from each round
	for (const round of roundResults) {
		for (const roundScore of round.scores) {
			const playerScore = scores.get(roundScore.playerId);
			if (!playerScore) continue;

			playerScore.totalPoints += roundScore.points;

			if (roundScore.correctGuess) {
				playerScore.correctGuesses += 1;
			}

			if (roundScore.isFastest) {
				playerScore.fastestGuesses += 1;
			}

			if (roundScore.isFeatured) {
				playerScore.timesFeatured += 1;
			}
		}
	}

	return scores;
}

/**
 * Get ranked list of players by total points (descending)
 */
export function getRankedScores(scores: Map<PlayerId, PlayerScore>): PlayerScore[] {
	return [...scores.values()].sort((a, b) => b.totalPoints - a.totalPoints);
}

/**
 * Determine the winner (player with highest score)
 * In case of tie, the first one in the list wins (arbitrary but consistent)
 */
export function determineWinner(scores: Map<PlayerId, PlayerScore>): PlayerId {
	const ranked = getRankedScores(scores);
	return ranked[0].playerId;
}
