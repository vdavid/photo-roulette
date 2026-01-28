import { describe, it, expect } from 'vitest';
import {
	findFastestCorrectGuesser,
	calculateRoundScores,
	calculateFinalScores,
	getRankedScores,
	determineWinner,
	createEmptyPlayerScore,
} from './scoring.js';
import { POINTS_CORRECT_GUESS, POINTS_FASTEST_BONUS, POINTS_FEATURED } from './constants.js';
import type { Guess, RoundResult } from './types.js';

describe('findFastestCorrectGuesser', () => {
	it('returns null when no guesses', () => {
		const result = findFastestCorrectGuesser([], 'owner1');
		expect(result).toBeNull();
	});

	it('returns null when no correct guesses', () => {
		const guesses: Guess[] = [
			{ playerId: 'p1', guessedOwnerId: 'wrong', timestamp: 100 },
			{ playerId: 'p2', guessedOwnerId: 'wrong', timestamp: 200 },
		];
		const result = findFastestCorrectGuesser(guesses, 'owner1');
		expect(result).toBeNull();
	});

	it('returns the only correct guesser', () => {
		const guesses: Guess[] = [
			{ playerId: 'p1', guessedOwnerId: 'wrong', timestamp: 100 },
			{ playerId: 'p2', guessedOwnerId: 'owner1', timestamp: 200 },
		];
		const result = findFastestCorrectGuesser(guesses, 'owner1');
		expect(result).toBe('p2');
	});

	it('returns the fastest among multiple correct guessers', () => {
		const guesses: Guess[] = [
			{ playerId: 'p1', guessedOwnerId: 'owner1', timestamp: 300 },
			{ playerId: 'p2', guessedOwnerId: 'owner1', timestamp: 100 },
			{ playerId: 'p3', guessedOwnerId: 'owner1', timestamp: 200 },
		];
		const result = findFastestCorrectGuesser(guesses, 'owner1');
		expect(result).toBe('p2');
	});

	it('returns first guesser on tie (same timestamp)', () => {
		const guesses: Guess[] = [
			{ playerId: 'p1', guessedOwnerId: 'owner1', timestamp: 100 },
			{ playerId: 'p2', guessedOwnerId: 'owner1', timestamp: 100 },
		];
		const result = findFastestCorrectGuesser(guesses, 'owner1');
		expect(result).toBe('p1');
	});
});

describe('calculateRoundScores', () => {
	const playerIds = ['p1', 'p2', 'p3', 'p4'];
	const photoOwnerId = 'p2';

	it('awards correct guess points', () => {
		const guesses: Guess[] = [
			{ playerId: 'p1', guessedOwnerId: 'p2', timestamp: 100 },
			{ playerId: 'p3', guessedOwnerId: 'p2', timestamp: 200 },
		];

		const scores = calculateRoundScores(playerIds, guesses, photoOwnerId);

		const p1Score = scores.find((s) => s.playerId === 'p1');
		const p3Score = scores.find((s) => s.playerId === 'p3');

		expect(p1Score?.correctGuess).toBe(true);
		expect(p3Score?.correctGuess).toBe(true);
	});

	it('awards fastest bonus to fastest correct guesser', () => {
		const guesses: Guess[] = [
			{ playerId: 'p1', guessedOwnerId: 'p2', timestamp: 200 },
			{ playerId: 'p3', guessedOwnerId: 'p2', timestamp: 100 },
		];

		const scores = calculateRoundScores(playerIds, guesses, photoOwnerId);

		const p1Score = scores.find((s) => s.playerId === 'p1');
		const p3Score = scores.find((s) => s.playerId === 'p3');

		expect(p1Score?.isFastest).toBe(false);
		expect(p3Score?.isFastest).toBe(true);
	});

	it('awards featured points to photo owner', () => {
		const guesses: Guess[] = [];

		const scores = calculateRoundScores(playerIds, guesses, photoOwnerId);

		const p2Score = scores.find((s) => s.playerId === 'p2');
		const p1Score = scores.find((s) => s.playerId === 'p1');

		expect(p2Score?.isFeatured).toBe(true);
		expect(p2Score?.points).toBe(POINTS_FEATURED);
		expect(p1Score?.isFeatured).toBe(false);
	});

	it('calculates correct total points for all scenarios', () => {
		const guesses: Guess[] = [
			{ playerId: 'p1', guessedOwnerId: 'p2', timestamp: 100 }, // correct + fastest
			{ playerId: 'p2', guessedOwnerId: 'p2', timestamp: 150 }, // correct + featured (self-guess)
			{ playerId: 'p3', guessedOwnerId: 'p2', timestamp: 200 }, // correct only
			{ playerId: 'p4', guessedOwnerId: 'wrong', timestamp: 50 }, // wrong guess
		];

		const scores = calculateRoundScores(playerIds, guesses, photoOwnerId);

		const p1Score = scores.find((s) => s.playerId === 'p1');
		const p2Score = scores.find((s) => s.playerId === 'p2');
		const p3Score = scores.find((s) => s.playerId === 'p3');
		const p4Score = scores.find((s) => s.playerId === 'p4');

		expect(p1Score?.points).toBe(POINTS_CORRECT_GUESS + POINTS_FASTEST_BONUS);
		expect(p2Score?.points).toBe(POINTS_CORRECT_GUESS + POINTS_FEATURED);
		expect(p3Score?.points).toBe(POINTS_CORRECT_GUESS);
		expect(p4Score?.points).toBe(0);
	});

	it('handles no guesses submitted', () => {
		const guesses: Guess[] = [];

		const scores = calculateRoundScores(playerIds, guesses, photoOwnerId);

		const p1Score = scores.find((s) => s.playerId === 'p1');
		const p2Score = scores.find((s) => s.playerId === 'p2');

		expect(p1Score?.points).toBe(0);
		expect(p1Score?.correctGuess).toBe(false);
		expect(p2Score?.points).toBe(POINTS_FEATURED); // photo owner still gets featured
	});

	it('handles everyone guessing wrong', () => {
		const guesses: Guess[] = [
			{ playerId: 'p1', guessedOwnerId: 'p3', timestamp: 100 },
			{ playerId: 'p3', guessedOwnerId: 'p1', timestamp: 200 },
			{ playerId: 'p4', guessedOwnerId: 'p3', timestamp: 300 },
		];

		const scores = calculateRoundScores(playerIds, guesses, photoOwnerId);

		expect(scores.every((s) => !s.isFastest)).toBe(true);
		expect(scores.filter((s) => !s.isFeatured).every((s) => s.points === 0)).toBe(true);
		expect(scores.find((s) => s.playerId === 'p2')?.points).toBe(POINTS_FEATURED);
	});

	it('allows photo owner to guess themselves and win', () => {
		const guesses: Guess[] = [
			{ playerId: 'p2', guessedOwnerId: 'p2', timestamp: 100 }, // owner guesses self, fastest
			{ playerId: 'p1', guessedOwnerId: 'p2', timestamp: 200 },
		];

		const scores = calculateRoundScores(playerIds, guesses, photoOwnerId);

		const p2Score = scores.find((s) => s.playerId === 'p2');

		expect(p2Score?.correctGuess).toBe(true);
		expect(p2Score?.isFastest).toBe(true);
		expect(p2Score?.isFeatured).toBe(true);
		expect(p2Score?.points).toBe(POINTS_CORRECT_GUESS + POINTS_FASTEST_BONUS + POINTS_FEATURED);
	});
});

describe('calculateFinalScores', () => {
	const playerIds = ['p1', 'p2', 'p3'];

	it('initializes scores for all players', () => {
		const scores = calculateFinalScores(playerIds, []);

		expect(scores.size).toBe(3);
		expect(scores.get('p1')).toBeDefined();
		expect(scores.get('p2')).toBeDefined();
		expect(scores.get('p3')).toBeDefined();
	});

	it('accumulates points across rounds', () => {
		const roundResults: RoundResult[] = [
			{
				roundNumber: 1,
				photoId: 'photo1',
				photoOwnerId: 'p1',
				guesses: [],
				scores: [
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p3', correctGuess: true, isFastest: false, isFeatured: false, points: 100 },
				],
				fastestCorrectGuesserId: 'p2',
			},
			{
				roundNumber: 2,
				photoId: 'photo2',
				photoOwnerId: 'p2',
				guesses: [],
				scores: [
					{ playerId: 'p1', correctGuess: true, isFastest: false, isFeatured: false, points: 100 },
					{ playerId: 'p2', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p3', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
				],
				fastestCorrectGuesserId: 'p3',
			},
		];

		const scores = calculateFinalScores(playerIds, roundResults);

		expect(scores.get('p1')?.totalPoints).toBe(150); // 50 + 100
		expect(scores.get('p2')?.totalPoints).toBe(200); // 150 + 50
		expect(scores.get('p3')?.totalPoints).toBe(250); // 100 + 150
	});

	it('tracks correct guesses count', () => {
		const roundResults: RoundResult[] = [
			{
				roundNumber: 1,
				photoId: 'photo1',
				photoOwnerId: 'p1',
				guesses: [],
				scores: [
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p3', correctGuess: true, isFastest: false, isFeatured: false, points: 100 },
				],
				fastestCorrectGuesserId: 'p2',
			},
			{
				roundNumber: 2,
				photoId: 'photo2',
				photoOwnerId: 'p2',
				guesses: [],
				scores: [
					{ playerId: 'p1', correctGuess: true, isFastest: false, isFeatured: false, points: 100 },
					{ playerId: 'p2', correctGuess: true, isFastest: false, isFeatured: true, points: 150 },
					{ playerId: 'p3', correctGuess: false, isFastest: false, isFeatured: false, points: 0 },
				],
				fastestCorrectGuesserId: null,
			},
		];

		const scores = calculateFinalScores(playerIds, roundResults);

		expect(scores.get('p1')?.correctGuesses).toBe(1);
		expect(scores.get('p2')?.correctGuesses).toBe(2);
		expect(scores.get('p3')?.correctGuesses).toBe(1);
	});

	it('tracks fastest guesses count', () => {
		const roundResults: RoundResult[] = [
			{
				roundNumber: 1,
				photoId: 'photo1',
				photoOwnerId: 'p1',
				guesses: [],
				scores: [
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p3', correctGuess: true, isFastest: false, isFeatured: false, points: 100 },
				],
				fastestCorrectGuesserId: 'p2',
			},
			{
				roundNumber: 2,
				photoId: 'photo2',
				photoOwnerId: 'p2',
				guesses: [],
				scores: [
					{ playerId: 'p1', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p2', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p3', correctGuess: false, isFastest: false, isFeatured: false, points: 0 },
				],
				fastestCorrectGuesserId: 'p1',
			},
		];

		const scores = calculateFinalScores(playerIds, roundResults);

		expect(scores.get('p1')?.fastestGuesses).toBe(1);
		expect(scores.get('p2')?.fastestGuesses).toBe(1);
		expect(scores.get('p3')?.fastestGuesses).toBe(0);
	});

	it('tracks times featured count', () => {
		const roundResults: RoundResult[] = [
			{
				roundNumber: 1,
				photoId: 'photo1',
				photoOwnerId: 'p1',
				guesses: [],
				scores: [
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p3', correctGuess: true, isFastest: false, isFeatured: false, points: 100 },
				],
				fastestCorrectGuesserId: 'p2',
			},
			{
				roundNumber: 2,
				photoId: 'photo2',
				photoOwnerId: 'p1',
				guesses: [],
				scores: [
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p3', correctGuess: true, isFastest: false, isFeatured: false, points: 100 },
				],
				fastestCorrectGuesserId: 'p2',
			},
		];

		const scores = calculateFinalScores(playerIds, roundResults);

		expect(scores.get('p1')?.timesFeatured).toBe(2);
		expect(scores.get('p2')?.timesFeatured).toBe(0);
		expect(scores.get('p3')?.timesFeatured).toBe(0);
	});
});

describe('getRankedScores', () => {
	it('returns empty array for empty scores', () => {
		const scores = new Map();
		const ranked = getRankedScores(scores);
		expect(ranked).toEqual([]);
	});

	it('ranks players by total points descending', () => {
		const scores = new Map([
			['p1', createEmptyPlayerScore('p1')],
			['p2', createEmptyPlayerScore('p2')],
			['p3', createEmptyPlayerScore('p3')],
		]);
		scores.get('p1')!.totalPoints = 100;
		scores.get('p2')!.totalPoints = 300;
		scores.get('p3')!.totalPoints = 200;

		const ranked = getRankedScores(scores);

		expect(ranked[0].playerId).toBe('p2');
		expect(ranked[1].playerId).toBe('p3');
		expect(ranked[2].playerId).toBe('p1');
	});
});

describe('determineWinner', () => {
	it('returns the player with highest score', () => {
		const scores = new Map([
			['p1', createEmptyPlayerScore('p1')],
			['p2', createEmptyPlayerScore('p2')],
			['p3', createEmptyPlayerScore('p3')],
		]);
		scores.get('p1')!.totalPoints = 100;
		scores.get('p2')!.totalPoints = 300;
		scores.get('p3')!.totalPoints = 200;

		const winner = determineWinner(scores);
		expect(winner).toBe('p2');
	});

	it('handles tie by returning first player in sorted order', () => {
		const scores = new Map([
			['p1', createEmptyPlayerScore('p1')],
			['p2', createEmptyPlayerScore('p2')],
		]);
		scores.get('p1')!.totalPoints = 200;
		scores.get('p2')!.totalPoints = 200;

		const winner = determineWinner(scores);
		// First one in the sorted array wins
		expect(['p1', 'p2']).toContain(winner);
	});
});
