import { describe, it, expect } from 'vitest';
import {
	calculateAgreePercent,
	isControversial,
	isUnanimous,
	calculateTakeAuthorPoints,
	calculateGuessPoints,
	createEmptyScore,
	initializeScores,
	updateScoresForTake,
	getRankedPlayers,
} from './scoring.js';
import type { Vote, Guess, TakeResult, HotTakesPlayer } from './types.js';
import {
	CORRECT_GUESS_POINTS,
	CONTROVERSIAL_TAKE_POINTS,
	UNANIMOUS_TAKE_POINTS,
} from './constants.js';

describe('calculateAgreePercent', () => {
	it('should return 50 for empty votes', () => {
		expect(calculateAgreePercent([])).toBe(50);
	});

	it('should return 100 for all agrees', () => {
		const votes: Vote[] = [
			{ playerId: 'p1', takeId: 't1', vote: 'agree' },
			{ playerId: 'p2', takeId: 't1', vote: 'agree' },
			{ playerId: 'p3', takeId: 't1', vote: 'agree' },
		];
		expect(calculateAgreePercent(votes)).toBe(100);
	});

	it('should return 0 for all disagrees', () => {
		const votes: Vote[] = [
			{ playerId: 'p1', takeId: 't1', vote: 'disagree' },
			{ playerId: 'p2', takeId: 't1', vote: 'disagree' },
			{ playerId: 'p3', takeId: 't1', vote: 'disagree' },
		];
		expect(calculateAgreePercent(votes)).toBe(0);
	});

	it('should return 50 for equal split', () => {
		const votes: Vote[] = [
			{ playerId: 'p1', takeId: 't1', vote: 'agree' },
			{ playerId: 'p2', takeId: 't1', vote: 'disagree' },
		];
		expect(calculateAgreePercent(votes)).toBe(50);
	});

	it('should round to nearest integer', () => {
		const votes: Vote[] = [
			{ playerId: 'p1', takeId: 't1', vote: 'agree' },
			{ playerId: 'p2', takeId: 't1', vote: 'agree' },
			{ playerId: 'p3', takeId: 't1', vote: 'disagree' },
		];
		expect(calculateAgreePercent(votes)).toBe(67); // 2/3 = 66.67%
	});
});

describe('isControversial', () => {
	it('should return true for 40%', () => {
		expect(isControversial(40)).toBe(true);
	});

	it('should return true for 50%', () => {
		expect(isControversial(50)).toBe(true);
	});

	it('should return true for 60%', () => {
		expect(isControversial(60)).toBe(true);
	});

	it('should return false for 39%', () => {
		expect(isControversial(39)).toBe(false);
	});

	it('should return false for 61%', () => {
		expect(isControversial(61)).toBe(false);
	});

	it('should return false for 0%', () => {
		expect(isControversial(0)).toBe(false);
	});

	it('should return false for 100%', () => {
		expect(isControversial(100)).toBe(false);
	});
});

describe('isUnanimous', () => {
	it('should return true for 0%', () => {
		expect(isUnanimous(0)).toBe(true);
	});

	it('should return true for 100%', () => {
		expect(isUnanimous(100)).toBe(true);
	});

	it('should return false for 50%', () => {
		expect(isUnanimous(50)).toBe(false);
	});

	it('should return false for 1%', () => {
		expect(isUnanimous(1)).toBe(false);
	});

	it('should return false for 99%', () => {
		expect(isUnanimous(99)).toBe(false);
	});
});

describe('calculateTakeAuthorPoints', () => {
	it('should give CONTROVERSIAL_TAKE_POINTS for 40-60% range', () => {
		expect(calculateTakeAuthorPoints(40)).toBe(CONTROVERSIAL_TAKE_POINTS);
		expect(calculateTakeAuthorPoints(50)).toBe(CONTROVERSIAL_TAKE_POINTS);
		expect(calculateTakeAuthorPoints(60)).toBe(CONTROVERSIAL_TAKE_POINTS);
	});

	it('should give UNANIMOUS_TAKE_POINTS for 0% or 100%', () => {
		expect(calculateTakeAuthorPoints(0)).toBe(UNANIMOUS_TAKE_POINTS);
		expect(calculateTakeAuthorPoints(100)).toBe(UNANIMOUS_TAKE_POINTS);
	});

	it('should give 0 points for other percentages', () => {
		expect(calculateTakeAuthorPoints(39)).toBe(0);
		expect(calculateTakeAuthorPoints(61)).toBe(0);
		expect(calculateTakeAuthorPoints(75)).toBe(0);
		expect(calculateTakeAuthorPoints(25)).toBe(0);
	});
});

describe('calculateGuessPoints', () => {
	it('should give CORRECT_GUESS_POINTS for correct guesses', () => {
		const guesses: Guess[] = [
			{ playerId: 'p1', takeId: 't1', guessedAuthorId: 'author1' },
			{ playerId: 'p2', takeId: 't1', guessedAuthorId: 'author1' },
			{ playerId: 'p3', takeId: 't1', guessedAuthorId: 'wrongAuthor' },
		];
		const points = calculateGuessPoints(guesses, 'author1');

		expect(points.get('p1')).toBe(CORRECT_GUESS_POINTS);
		expect(points.get('p2')).toBe(CORRECT_GUESS_POINTS);
		expect(points.has('p3')).toBe(false);
	});

	it('should return empty map when no correct guesses', () => {
		const guesses: Guess[] = [
			{ playerId: 'p1', takeId: 't1', guessedAuthorId: 'wrongAuthor' },
			{ playerId: 'p2', takeId: 't1', guessedAuthorId: 'anotherWrong' },
		];
		const points = calculateGuessPoints(guesses, 'author1');

		expect(points.size).toBe(0);
	});

	it('should handle empty guesses array', () => {
		const points = calculateGuessPoints([], 'author1');
		expect(points.size).toBe(0);
	});
});

describe('createEmptyScore', () => {
	it('should create score with all zeros', () => {
		const score = createEmptyScore();
		expect(score.totalPoints).toBe(0);
		expect(score.correctGuesses).toBe(0);
		expect(score.controversialTakes).toBe(0);
	});
});

describe('initializeScores', () => {
	it('should create scores for all non-spectator players', () => {
		const players: HotTakesPlayer[] = [
			{
				id: 'p1',
				name: 'Player 1',
				emoji: '🐰',
				isReady: true,
				isSpectator: false,
				takeIds: [],
				isConnected: true,
			},
			{
				id: 'p2',
				name: 'Player 2',
				emoji: '🦊',
				isReady: true,
				isSpectator: false,
				takeIds: [],
				isConnected: true,
			},
			{
				id: 'p3',
				name: 'Spectator',
				emoji: '👀',
				isReady: true,
				isSpectator: true,
				takeIds: [],
				isConnected: true,
			},
		];

		const scores = initializeScores(players);

		expect(scores.has('p1')).toBe(true);
		expect(scores.has('p2')).toBe(true);
		expect(scores.has('p3')).toBe(false); // Spectator excluded
	});
});

describe('updateScoresForTake', () => {
	it('should add author points for controversial take', () => {
		const currentScores = new Map([
			['author1', { totalPoints: 0, correctGuesses: 0, controversialTakes: 0 }],
			['p1', { totalPoints: 0, correctGuesses: 0, controversialTakes: 0 }],
		]);

		const result: TakeResult = {
			takeId: 't1',
			authorId: 'author1',
			votes: [],
			guesses: [{ playerId: 'p1', takeId: 't1', guessedAuthorId: 'author1' }],
			agreePercent: 50, // Controversial
			isControversial: true,
		};

		const newScores = updateScoresForTake(currentScores, result);

		expect(newScores.get('author1')!.totalPoints).toBe(CONTROVERSIAL_TAKE_POINTS);
		expect(newScores.get('author1')!.controversialTakes).toBe(1);
		expect(newScores.get('p1')!.totalPoints).toBe(CORRECT_GUESS_POINTS);
		expect(newScores.get('p1')!.correctGuesses).toBe(1);
	});

	it('should not add controversy points for non-controversial take', () => {
		const currentScores = new Map([
			['author1', { totalPoints: 0, correctGuesses: 0, controversialTakes: 0 }],
		]);

		const result: TakeResult = {
			takeId: 't1',
			authorId: 'author1',
			votes: [],
			guesses: [],
			agreePercent: 80, // Not controversial
			isControversial: false,
		};

		const newScores = updateScoresForTake(currentScores, result);

		expect(newScores.get('author1')!.totalPoints).toBe(0);
		expect(newScores.get('author1')!.controversialTakes).toBe(0);
	});
});

describe('getRankedPlayers', () => {
	it('should rank players by score descending', () => {
		const players: HotTakesPlayer[] = [
			{
				id: 'p1',
				name: 'Player 1',
				emoji: '🐰',
				isReady: true,
				isSpectator: false,
				takeIds: [],
				isConnected: true,
			},
			{
				id: 'p2',
				name: 'Player 2',
				emoji: '🦊',
				isReady: true,
				isSpectator: false,
				takeIds: [],
				isConnected: true,
			},
			{
				id: 'p3',
				name: 'Player 3',
				emoji: '🐻',
				isReady: true,
				isSpectator: false,
				takeIds: [],
				isConnected: true,
			},
		];

		const scores = new Map([
			['p1', { totalPoints: 100, correctGuesses: 1, controversialTakes: 0 }],
			['p2', { totalPoints: 200, correctGuesses: 2, controversialTakes: 0 }],
			['p3', { totalPoints: 50, correctGuesses: 0, controversialTakes: 1 }],
		]);

		const rankings = getRankedPlayers(players, scores);

		expect(rankings[0].playerId).toBe('p2');
		expect(rankings[0].rank).toBe(1);
		expect(rankings[1].playerId).toBe('p1');
		expect(rankings[1].rank).toBe(2);
		expect(rankings[2].playerId).toBe('p3');
		expect(rankings[2].rank).toBe(3);
	});

	it('should handle tied scores with same rank', () => {
		const players: HotTakesPlayer[] = [
			{
				id: 'p1',
				name: 'Player 1',
				emoji: '🐰',
				isReady: true,
				isSpectator: false,
				takeIds: [],
				isConnected: true,
			},
			{
				id: 'p2',
				name: 'Player 2',
				emoji: '🦊',
				isReady: true,
				isSpectator: false,
				takeIds: [],
				isConnected: true,
			},
			{
				id: 'p3',
				name: 'Player 3',
				emoji: '🐻',
				isReady: true,
				isSpectator: false,
				takeIds: [],
				isConnected: true,
			},
		];

		const scores = new Map([
			['p1', { totalPoints: 100, correctGuesses: 1, controversialTakes: 0 }],
			['p2', { totalPoints: 100, correctGuesses: 1, controversialTakes: 0 }], // Tied with p1
			['p3', { totalPoints: 50, correctGuesses: 0, controversialTakes: 1 }],
		]);

		const rankings = getRankedPlayers(players, scores);

		// Both tied players should have rank 1
		expect(rankings[0].rank).toBe(1);
		expect(rankings[1].rank).toBe(1);
		// Third player should have rank 3 (not 2)
		expect(rankings[2].rank).toBe(3);
	});

	it('should exclude spectators from rankings', () => {
		const players: HotTakesPlayer[] = [
			{
				id: 'p1',
				name: 'Player 1',
				emoji: '🐰',
				isReady: true,
				isSpectator: false,
				takeIds: [],
				isConnected: true,
			},
			{
				id: 'spectator',
				name: 'Spectator',
				emoji: '👀',
				isReady: true,
				isSpectator: true,
				takeIds: [],
				isConnected: true,
			},
		];

		const scores = new Map([
			['p1', { totalPoints: 100, correctGuesses: 1, controversialTakes: 0 }],
		]);

		const rankings = getRankedPlayers(players, scores);

		expect(rankings.length).toBe(1);
		expect(rankings[0].playerId).toBe('p1');
	});
});
