import { describe, it, expect } from 'vitest';
import {
	calculatePlayerStats,
	findFastestFingers,
	findMostFeatured,
	findSharpshooter,
	findLuckyGuesser,
	formatAccuracy,
	calculateSuperlatives,
	getSuperlativeByType,
} from './superlatives.js';
import type { RoundResult, Guess } from './types.js';

const createRoundResult = (
	roundNumber: number,
	photoOwnerId: string,
	scores: {
		playerId: string;
		correctGuess: boolean;
		isFastest: boolean;
		isFeatured: boolean;
		points: number;
	}[],
	guesses: Guess[] = []
): RoundResult => ({
	roundNumber,
	photoId: `photo${roundNumber}`,
	photoOwnerId,
	guesses,
	scores: scores.map((s) => ({ ...s })),
	fastestCorrectGuesserId: scores.find((s) => s.isFastest)?.playerId || null,
});

describe('calculatePlayerStats', () => {
	it('initializes stats for all players', () => {
		const stats = calculatePlayerStats(['p1', 'p2', 'p3'], []);

		expect(stats.size).toBe(3);
		expect(stats.get('p1')).toBeDefined();
		expect(stats.get('p1')?.correctGuesses).toBe(0);
		expect(stats.get('p1')?.accuracy).toBe(0);
	});

	it('counts correct guesses', () => {
		const roundResults: RoundResult[] = [
			createRoundResult(
				1,
				'p1',
				[
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p3', correctGuess: true, isFastest: false, isFeatured: false, points: 100 },
				],
				[
					{ playerId: 'p2', guessedOwnerId: 'p1', timestamp: 100 },
					{ playerId: 'p3', guessedOwnerId: 'p1', timestamp: 200 },
				]
			),
			createRoundResult(
				2,
				'p2',
				[
					{ playerId: 'p1', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p2', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p3', correctGuess: false, isFastest: false, isFeatured: false, points: 0 },
				],
				[
					{ playerId: 'p1', guessedOwnerId: 'p2', timestamp: 100 },
					{ playerId: 'p3', guessedOwnerId: 'p1', timestamp: 200 },
				]
			),
		];

		const stats = calculatePlayerStats(['p1', 'p2', 'p3'], roundResults);

		expect(stats.get('p1')?.correctGuesses).toBe(1);
		expect(stats.get('p2')?.correctGuesses).toBe(1);
		expect(stats.get('p3')?.correctGuesses).toBe(1);
	});

	it('counts fastest guesses', () => {
		const roundResults: RoundResult[] = [
			createRoundResult(
				1,
				'p1',
				[
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
				],
				[{ playerId: 'p2', guessedOwnerId: 'p1', timestamp: 100 }]
			),
			createRoundResult(
				2,
				'p2',
				[
					{ playerId: 'p1', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p2', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
				],
				[{ playerId: 'p1', guessedOwnerId: 'p2', timestamp: 100 }]
			),
			createRoundResult(
				3,
				'p3',
				[
					{ playerId: 'p1', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p2', correctGuess: true, isFastest: false, isFeatured: false, points: 100 },
				],
				[
					{ playerId: 'p1', guessedOwnerId: 'p3', timestamp: 100 },
					{ playerId: 'p2', guessedOwnerId: 'p3', timestamp: 200 },
				]
			),
		];

		const stats = calculatePlayerStats(['p1', 'p2'], roundResults);

		expect(stats.get('p1')?.fastestGuesses).toBe(2);
		expect(stats.get('p2')?.fastestGuesses).toBe(1);
	});

	it('counts times featured', () => {
		const roundResults: RoundResult[] = [
			createRoundResult(1, 'p1', [
				{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
				{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
			]),
			createRoundResult(2, 'p1', [
				{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
				{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
			]),
			createRoundResult(3, 'p2', [
				{ playerId: 'p1', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
				{ playerId: 'p2', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
			]),
		];

		const stats = calculatePlayerStats(['p1', 'p2'], roundResults);

		expect(stats.get('p1')?.timesFeatured).toBe(2);
		expect(stats.get('p2')?.timesFeatured).toBe(1);
	});

	it('calculates accuracy correctly', () => {
		const roundResults: RoundResult[] = [
			createRoundResult(
				1,
				'p1',
				[
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
				],
				[{ playerId: 'p2', guessedOwnerId: 'p1', timestamp: 100 }]
			),
			createRoundResult(
				2,
				'p2',
				[
					{ playerId: 'p1', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p2', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
				],
				[{ playerId: 'p1', guessedOwnerId: 'p2', timestamp: 100 }]
			),
			createRoundResult(
				3,
				'p3',
				[
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: false, points: 0 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
				],
				[
					{ playerId: 'p1', guessedOwnerId: 'p1', timestamp: 100 },
					{ playerId: 'p2', guessedOwnerId: 'p3', timestamp: 200 },
				]
			),
			createRoundResult(
				4,
				'p4',
				[
					{ playerId: 'p1', correctGuess: true, isFastest: false, isFeatured: false, points: 100 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
				],
				[
					{ playerId: 'p1', guessedOwnerId: 'p4', timestamp: 200 },
					{ playerId: 'p2', guessedOwnerId: 'p4', timestamp: 100 },
				]
			),
		];

		const stats = calculatePlayerStats(['p1', 'p2'], roundResults);

		// p1: 2 correct out of 3 guesses (rounds 2, 3, 4) = 66.67%
		expect(stats.get('p1')?.accuracy).toBeCloseTo(0.667, 2);
		// p2: 3 correct out of 3 guesses (rounds 1, 3, 4) = 100%
		expect(stats.get('p2')?.accuracy).toBe(1.0);
	});

	it('handles players who never guessed', () => {
		const roundResults: RoundResult[] = [
			createRoundResult(1, 'p1', [
				{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
				{ playerId: 'p2', correctGuess: false, isFastest: false, isFeatured: false, points: 0 },
			]),
		];

		const stats = calculatePlayerStats(['p1', 'p2'], roundResults);

		expect(stats.get('p2')?.accuracy).toBe(0);
		expect(stats.get('p2')?.totalGuesses).toBe(0);
	});
});

describe('findFastestFingers', () => {
	it('returns null for empty stats', () => {
		const stats = new Map();
		expect(findFastestFingers(stats)).toBeNull();
	});

	it('returns null when no one has fastest guesses', () => {
		const stats = calculatePlayerStats(['p1', 'p2'], []);
		expect(findFastestFingers(stats)).toBeNull();
	});

	it('finds player with most fastest guesses', () => {
		const stats = new Map([
			[
				'p1',
				{
					playerId: 'p1',
					correctGuesses: 3,
					totalGuesses: 5,
					fastestGuesses: 2,
					timesFeatured: 1,
					accuracy: 0.6,
				},
			],
			[
				'p2',
				{
					playerId: 'p2',
					correctGuesses: 4,
					totalGuesses: 5,
					fastestGuesses: 3,
					timesFeatured: 1,
					accuracy: 0.8,
				},
			],
		]);

		const result = findFastestFingers(stats);

		expect(result?.playerId).toBe('p2');
		expect(result?.count).toBe(3);
	});
});

describe('findMostFeatured', () => {
	it('returns null for empty stats', () => {
		const stats = new Map();
		expect(findMostFeatured(stats)).toBeNull();
	});

	it('finds player featured most often', () => {
		const stats = new Map([
			[
				'p1',
				{
					playerId: 'p1',
					correctGuesses: 3,
					totalGuesses: 5,
					fastestGuesses: 2,
					timesFeatured: 4,
					accuracy: 0.6,
				},
			],
			[
				'p2',
				{
					playerId: 'p2',
					correctGuesses: 4,
					totalGuesses: 5,
					fastestGuesses: 3,
					timesFeatured: 2,
					accuracy: 0.8,
				},
			],
		]);

		const result = findMostFeatured(stats);

		expect(result?.playerId).toBe('p1');
		expect(result?.count).toBe(4);
	});
});

describe('findSharpshooter', () => {
	it('returns null for empty stats', () => {
		const stats = new Map();
		expect(findSharpshooter(stats)).toBeNull();
	});

	it('returns null when no one meets minimum guesses', () => {
		const stats = new Map([
			[
				'p1',
				{
					playerId: 'p1',
					correctGuesses: 2,
					totalGuesses: 2,
					fastestGuesses: 0,
					timesFeatured: 0,
					accuracy: 1.0,
				},
			],
		]);

		expect(findSharpshooter(stats, 3)).toBeNull();
	});

	it('finds player with highest accuracy', () => {
		const stats = new Map([
			[
				'p1',
				{
					playerId: 'p1',
					correctGuesses: 4,
					totalGuesses: 5,
					fastestGuesses: 2,
					timesFeatured: 1,
					accuracy: 0.8,
				},
			],
			[
				'p2',
				{
					playerId: 'p2',
					correctGuesses: 5,
					totalGuesses: 5,
					fastestGuesses: 1,
					timesFeatured: 1,
					accuracy: 1.0,
				},
			],
		]);

		const result = findSharpshooter(stats, 3);

		expect(result?.playerId).toBe('p2');
		expect(result?.accuracy).toBe(1.0);
	});
});

describe('findLuckyGuesser', () => {
	it('returns null for empty stats', () => {
		const stats = new Map();
		expect(findLuckyGuesser(stats)).toBeNull();
	});

	it('returns null when no one has correct guesses', () => {
		const stats = new Map([
			[
				'p1',
				{
					playerId: 'p1',
					correctGuesses: 0,
					totalGuesses: 5,
					fastestGuesses: 0,
					timesFeatured: 0,
					accuracy: 0,
				},
			],
		]);

		expect(findLuckyGuesser(stats)).toBeNull();
	});

	it('finds player with lowest accuracy who still got some correct', () => {
		const stats = new Map([
			[
				'p1',
				{
					playerId: 'p1',
					correctGuesses: 4,
					totalGuesses: 5,
					fastestGuesses: 2,
					timesFeatured: 1,
					accuracy: 0.8,
				},
			],
			[
				'p2',
				{
					playerId: 'p2',
					correctGuesses: 2,
					totalGuesses: 5,
					fastestGuesses: 1,
					timesFeatured: 1,
					accuracy: 0.4,
				},
			],
		]);

		const result = findLuckyGuesser(stats, 3);

		expect(result?.playerId).toBe('p2');
		expect(result?.accuracy).toBe(0.4);
	});
});

describe('formatAccuracy', () => {
	it('formats 0 as 0%', () => {
		expect(formatAccuracy(0)).toBe('0%');
	});

	it('formats 1 as 100%', () => {
		expect(formatAccuracy(1)).toBe('100%');
	});

	it('formats decimal as rounded percentage', () => {
		expect(formatAccuracy(0.756)).toBe('76%');
		expect(formatAccuracy(0.333)).toBe('33%');
	});
});

describe('calculateSuperlatives', () => {
	const playerNames = new Map([
		['p1', 'Alice'],
		['p2', 'Bob'],
		['p3', 'Charlie'],
	]);

	it('returns empty array for no rounds', () => {
		const superlatives = calculateSuperlatives(['p1', 'p2'], [], playerNames);
		expect(superlatives).toEqual([]);
	});

	it('creates superlatives with player names', () => {
		const roundResults: RoundResult[] = [
			createRoundResult(
				1,
				'p1',
				[
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p3', correctGuess: true, isFastest: false, isFeatured: false, points: 100 },
				],
				[
					{ playerId: 'p2', guessedOwnerId: 'p1', timestamp: 100 },
					{ playerId: 'p3', guessedOwnerId: 'p1', timestamp: 200 },
				]
			),
			createRoundResult(
				2,
				'p1',
				[
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p3', correctGuess: false, isFastest: false, isFeatured: false, points: 0 },
				],
				[
					{ playerId: 'p2', guessedOwnerId: 'p1', timestamp: 100 },
					{ playerId: 'p3', guessedOwnerId: 'p2', timestamp: 200 },
				]
			),
			createRoundResult(
				3,
				'p2',
				[
					{ playerId: 'p1', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
					{ playerId: 'p2', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p3', correctGuess: false, isFastest: false, isFeatured: false, points: 0 },
				],
				[
					{ playerId: 'p1', guessedOwnerId: 'p2', timestamp: 100 },
					{ playerId: 'p3', guessedOwnerId: 'p1', timestamp: 200 },
				]
			),
		];

		const superlatives = calculateSuperlatives(['p1', 'p2', 'p3'], roundResults, playerNames);

		// Should have multiple superlatives
		expect(superlatives.length).toBeGreaterThan(0);

		// Check fastest fingers
		const fastestFingers = superlatives.find((s) => s.type === 'fastestFingers');
		expect(fastestFingers?.playerId).toBe('p2');
		expect(fastestFingers?.description).toBe('Bob');

		// Check most featured
		const mostFeatured = superlatives.find((s) => s.type === 'mostFeatured');
		expect(mostFeatured?.playerId).toBe('p1');
		expect(mostFeatured?.description).toBe('Alice');
	});

	it('does not include lucky guesser if same as sharpshooter', () => {
		// When only one player has guesses, they'd be both sharpshooter and lucky guesser
		const roundResults: RoundResult[] = [
			createRoundResult(
				1,
				'p1',
				[
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
				],
				[{ playerId: 'p2', guessedOwnerId: 'p1', timestamp: 100 }]
			),
			createRoundResult(
				2,
				'p2',
				[
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: false, points: 0 },
					{ playerId: 'p2', correctGuess: false, isFastest: false, isFeatured: true, points: 50 },
				],
				[]
			),
			createRoundResult(
				3,
				'p3',
				[
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: false, points: 0 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
				],
				[{ playerId: 'p2', guessedOwnerId: 'p3', timestamp: 100 }]
			),
			createRoundResult(
				4,
				'p4',
				[
					{ playerId: 'p1', correctGuess: false, isFastest: false, isFeatured: false, points: 0 },
					{ playerId: 'p2', correctGuess: true, isFastest: true, isFeatured: false, points: 150 },
				],
				[{ playerId: 'p2', guessedOwnerId: 'p4', timestamp: 100 }]
			),
		];

		const superlatives = calculateSuperlatives(['p1', 'p2'], roundResults, playerNames);

		// p2 should be sharpshooter (100% accuracy with 3 guesses)
		const sharpshooter = superlatives.find((s) => s.type === 'sharpshooter');
		expect(sharpshooter?.playerId).toBe('p2');

		// lucky guesser should not exist (p2 is both, p1 has no correct guesses)
		const luckyGuesser = superlatives.find((s) => s.type === 'luckyGuesser');
		expect(luckyGuesser).toBeUndefined();
	});
});

describe('getSuperlativeByType', () => {
	it('returns superlative by type', () => {
		const superlatives = [
			{
				type: 'fastestFingers' as const,
				playerId: 'p1',
				label: 'Fastest fingers',
				description: 'Alice',
				value: '3 times',
			},
			{
				type: 'sharpshooter' as const,
				playerId: 'p2',
				label: 'Sharpshooter',
				description: 'Bob',
				value: '90%',
			},
		];

		expect(getSuperlativeByType(superlatives, 'fastestFingers')?.playerId).toBe('p1');
		expect(getSuperlativeByType(superlatives, 'sharpshooter')?.playerId).toBe('p2');
	});

	it('returns undefined for missing type', () => {
		const superlatives = [
			{
				type: 'fastestFingers' as const,
				playerId: 'p1',
				label: 'Fastest fingers',
				description: 'Alice',
				value: '3 times',
			},
		];

		expect(getSuperlativeByType(superlatives, 'luckyGuesser')).toBeUndefined();
	});
});
