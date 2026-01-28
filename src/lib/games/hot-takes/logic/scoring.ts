/**
 * Hot Takes scoring logic
 */

import type { PlayerId } from '$lib/common/networking/types.js';
import type { Vote, Guess, TakeResult, PlayerScore, HotTakesPlayer } from './types.js';
import {
	CORRECT_GUESS_POINTS,
	CONTROVERSIAL_TAKE_POINTS,
	UNANIMOUS_TAKE_POINTS,
	CONTROVERSIAL_MIN_PERCENT,
	CONTROVERSIAL_MAX_PERCENT,
} from './constants.js';

/**
 * Calculate the agree percentage from votes
 */
export function calculateAgreePercent(votes: Vote[]): number {
	if (votes.length === 0) return 50; // Default to neutral if no votes

	const agreeCount = votes.filter((v) => v.vote === 'agree').length;
	return Math.round((agreeCount / votes.length) * 100);
}

/**
 * Check if a vote split is controversial (40-60%)
 */
export function isControversial(agreePercent: number): boolean {
	return agreePercent >= CONTROVERSIAL_MIN_PERCENT && agreePercent <= CONTROVERSIAL_MAX_PERCENT;
}

/**
 * Check if a vote was unanimous (100% agree or 100% disagree)
 */
export function isUnanimous(agreePercent: number): boolean {
	return agreePercent === 0 || agreePercent === 100;
}

/**
 * Calculate points for the author of a take based on vote distribution
 */
export function calculateTakeAuthorPoints(agreePercent: number): number {
	if (isControversial(agreePercent)) {
		return CONTROVERSIAL_TAKE_POINTS;
	}
	if (isUnanimous(agreePercent)) {
		return UNANIMOUS_TAKE_POINTS;
	}
	return 0;
}

/**
 * Calculate points earned from guesses on a take
 * Returns a map of playerId -> points earned
 */
export function calculateGuessPoints(guesses: Guess[], authorId: PlayerId): Map<PlayerId, number> {
	const points = new Map<PlayerId, number>();

	for (const guess of guesses) {
		if (guess.guessedAuthorId === authorId) {
			points.set(guess.playerId, CORRECT_GUESS_POINTS);
		}
	}

	return points;
}

/**
 * Create an empty player score
 */
export function createEmptyScore(): PlayerScore {
	return {
		totalPoints: 0,
		correctGuesses: 0,
		controversialTakes: 0,
	};
}

/**
 * Initialize scores for all players
 */
export function initializeScores(players: HotTakesPlayer[]): Map<PlayerId, PlayerScore> {
	const scores = new Map<PlayerId, PlayerScore>();
	for (const player of players) {
		if (!player.isSpectator) {
			scores.set(player.id, createEmptyScore());
		}
	}
	return scores;
}

/**
 * Update scores after a take is revealed
 */
export function updateScoresForTake(
	currentScores: Map<PlayerId, PlayerScore>,
	result: TakeResult
): Map<PlayerId, PlayerScore> {
	const newScores = new Map(currentScores);

	// Award points to the author
	const authorScore = newScores.get(result.authorId) || createEmptyScore();
	const authorPoints = calculateTakeAuthorPoints(result.agreePercent);
	authorScore.totalPoints += authorPoints;
	if (result.isControversial) {
		authorScore.controversialTakes++;
	}
	newScores.set(result.authorId, authorScore);

	// Award points to correct guessers
	const guessPoints = calculateGuessPoints(result.guesses, result.authorId);
	for (const [playerId, points] of guessPoints) {
		const playerScore = newScores.get(playerId) || createEmptyScore();
		playerScore.totalPoints += points;
		playerScore.correctGuesses++;
		newScores.set(playerId, playerScore);
	}

	return newScores;
}

/**
 * Calculate final scores from all take results
 */
export function calculateFinalScores(
	players: HotTakesPlayer[],
	results: TakeResult[]
): Map<PlayerId, PlayerScore> {
	let scores = initializeScores(players);

	for (const result of results) {
		scores = updateScoresForTake(scores, result);
	}

	return scores;
}

/**
 * Get players ranked by score (highest first)
 */
export function getRankedPlayers(
	players: HotTakesPlayer[],
	scores: Map<PlayerId, PlayerScore>
): Array<{
	playerId: PlayerId;
	playerName: string;
	playerEmoji: string;
	score: PlayerScore;
	rank: number;
}> {
	const activePlayers = players.filter((p) => !p.isSpectator);

	const ranked = activePlayers
		.map((player) => ({
			playerId: player.id,
			playerName: player.name,
			playerEmoji: player.emoji,
			score: scores.get(player.id) || createEmptyScore(),
			rank: 0,
		}))
		.sort((a, b) => b.score.totalPoints - a.score.totalPoints);

	// Assign ranks (handle ties)
	let currentRank = 1;
	for (let i = 0; i < ranked.length; i++) {
		if (i > 0 && ranked[i].score.totalPoints < ranked[i - 1].score.totalPoints) {
			currentRank = i + 1;
		}
		ranked[i].rank = currentRank;
	}

	return ranked;
}
