import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
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
import type { Photo, Round, Guess, PhotoPool } from './types.js';

describe('createPhotoPool', () => {
	it('creates pool with all photos available', () => {
		const photos: Photo[] = [
			{ id: 'p1', ownerId: 'player1', baseUrl: 'url1' },
			{ id: 'p2', ownerId: 'player2', baseUrl: 'url2' },
		];

		const pool = createPhotoPool(photos);

		expect(pool.available).toHaveLength(2);
		expect(pool.used).toHaveLength(0);
	});

	it('creates a copy of the photos array', () => {
		const photos: Photo[] = [{ id: 'p1', ownerId: 'player1', baseUrl: 'url1' }];

		const pool = createPhotoPool(photos);
		photos.push({ id: 'p2', ownerId: 'player2', baseUrl: 'url2' });

		expect(pool.available).toHaveLength(1);
	});
});

describe('selectRandomPhoto', () => {
	beforeEach(() => {
		vi.spyOn(Math, 'random').mockReturnValue(0);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns null for empty pool', () => {
		const pool: PhotoPool = { available: [], used: [] };
		const result = selectRandomPhoto(pool);
		expect(result).toBeNull();
	});

	it('selects photo and moves to used', () => {
		const pool: PhotoPool = {
			available: [
				{ id: 'p1', ownerId: 'player1', baseUrl: 'url1' },
				{ id: 'p2', ownerId: 'player2', baseUrl: 'url2' },
			],
			used: [],
		};

		const result = selectRandomPhoto(pool);

		expect(result).not.toBeNull();
		expect(result!.photo.id).toBe('p1');
		expect(result!.updatedPool.available).toHaveLength(1);
		expect(result!.updatedPool.used).toHaveLength(1);
		expect(result!.updatedPool.used[0].id).toBe('p1');
	});

	it('recycles used photos when available is empty', () => {
		const pool: PhotoPool = {
			available: [],
			used: [
				{ id: 'p1', ownerId: 'player1', baseUrl: 'url1' },
				{ id: 'p2', ownerId: 'player2', baseUrl: 'url2' },
			],
		};

		const result = selectRandomPhoto(pool);

		expect(result).not.toBeNull();
		expect(result!.updatedPool.available).toHaveLength(1);
		expect(result!.updatedPool.used).toHaveLength(1);
	});

	it('does not modify original pool', () => {
		const pool: PhotoPool = {
			available: [{ id: 'p1', ownerId: 'player1', baseUrl: 'url1' }],
			used: [],
		};

		selectRandomPhoto(pool);

		expect(pool.available).toHaveLength(1);
		expect(pool.used).toHaveLength(0);
	});
});

describe('shuffleArray', () => {
	it('returns array of same length', () => {
		const arr = [1, 2, 3, 4, 5];
		const shuffled = shuffleArray(arr);
		expect(shuffled).toHaveLength(5);
	});

	it('contains same elements', () => {
		const arr = [1, 2, 3, 4, 5];
		const shuffled = shuffleArray(arr);
		expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
	});

	it('does not modify original array', () => {
		const arr = [1, 2, 3, 4, 5];
		shuffleArray(arr);
		expect(arr).toEqual([1, 2, 3, 4, 5]);
	});

	it('handles empty array', () => {
		const shuffled = shuffleArray([]);
		expect(shuffled).toEqual([]);
	});

	it('handles single element', () => {
		const shuffled = shuffleArray([1]);
		expect(shuffled).toEqual([1]);
	});
});

describe('createRound', () => {
	it('creates round with correct properties', () => {
		const photo: Photo = { id: 'photo1', ownerId: 'player1', baseUrl: 'url' };
		const round = createRound(1, photo, 1000);

		expect(round.roundNumber).toBe(1);
		expect(round.photoId).toBe('photo1');
		expect(round.photoOwnerId).toBe('player1');
		expect(round.guesses).toEqual([]);
		expect(round.startTime).toBe(1000);
	});
});

describe('addGuess', () => {
	it('adds guess to round', () => {
		const round: Round = {
			roundNumber: 1,
			photoId: 'photo1',
			photoOwnerId: 'player1',
			guesses: [],
			startTime: 1000,
		};

		const guess: Guess = {
			playerId: 'player2',
			guessedOwnerId: 'player1',
			timestamp: 1500,
		};

		const updated = addGuess(round, guess);

		expect(updated.guesses).toHaveLength(1);
		expect(updated.guesses[0]).toEqual(guess);
	});

	it('does not modify original round', () => {
		const round: Round = {
			roundNumber: 1,
			photoId: 'photo1',
			photoOwnerId: 'player1',
			guesses: [],
			startTime: 1000,
		};

		const guess: Guess = {
			playerId: 'player2',
			guessedOwnerId: 'player1',
			timestamp: 1500,
		};

		addGuess(round, guess);

		expect(round.guesses).toHaveLength(0);
	});
});

describe('updateGuess', () => {
	it('updates existing guess', () => {
		const round: Round = {
			roundNumber: 1,
			photoId: 'photo1',
			photoOwnerId: 'player1',
			guesses: [{ playerId: 'player2', guessedOwnerId: 'player3', timestamp: 1500 }],
			startTime: 1000,
		};

		const newGuess: Guess = {
			playerId: 'player2',
			guessedOwnerId: 'player1',
			timestamp: 2000,
		};

		const updated = updateGuess(round, newGuess);

		expect(updated.guesses).toHaveLength(1);
		expect(updated.guesses[0].guessedOwnerId).toBe('player1');
		expect(updated.guesses[0].timestamp).toBe(2000);
	});

	it('adds new guess if player has not guessed', () => {
		const round: Round = {
			roundNumber: 1,
			photoId: 'photo1',
			photoOwnerId: 'player1',
			guesses: [],
			startTime: 1000,
		};

		const guess: Guess = {
			playerId: 'player2',
			guessedOwnerId: 'player1',
			timestamp: 1500,
		};

		const updated = updateGuess(round, guess);

		expect(updated.guesses).toHaveLength(1);
	});
});

describe('completeRound', () => {
	it('generates round result with scores', () => {
		const round: Round = {
			roundNumber: 1,
			photoId: 'photo1',
			photoOwnerId: 'player1',
			guesses: [
				{ playerId: 'player2', guessedOwnerId: 'player1', timestamp: 1500 },
				{ playerId: 'player3', guessedOwnerId: 'player2', timestamp: 1600 },
			],
			startTime: 1000,
		};

		const result = completeRound(round, ['player1', 'player2', 'player3']);

		expect(result.roundNumber).toBe(1);
		expect(result.photoId).toBe('photo1');
		expect(result.photoOwnerId).toBe('player1');
		expect(result.scores).toHaveLength(3);
		expect(result.fastestCorrectGuesserId).toBe('player2');
	});

	it('handles no correct guesses', () => {
		const round: Round = {
			roundNumber: 1,
			photoId: 'photo1',
			photoOwnerId: 'player1',
			guesses: [{ playerId: 'player2', guessedOwnerId: 'player3', timestamp: 1500 }],
			startTime: 1000,
		};

		const result = completeRound(round, ['player1', 'player2']);

		expect(result.fastestCorrectGuesserId).toBeNull();
	});
});

describe('allPlayersGuessed', () => {
	const round: Round = {
		roundNumber: 1,
		photoId: 'photo1',
		photoOwnerId: 'player1',
		guesses: [
			{ playerId: 'player1', guessedOwnerId: 'player2', timestamp: 1500 },
			{ playerId: 'player2', guessedOwnerId: 'player1', timestamp: 1600 },
		],
		startTime: 1000,
	};

	it('returns true when all players have guessed', () => {
		expect(allPlayersGuessed(round, ['player1', 'player2'])).toBe(true);
	});

	it('returns false when some players have not guessed', () => {
		expect(allPlayersGuessed(round, ['player1', 'player2', 'player3'])).toBe(false);
	});

	it('returns true for empty player list', () => {
		const emptyRound: Round = { ...round, guesses: [] };
		expect(allPlayersGuessed(emptyRound, [])).toBe(true);
	});
});

describe('getGuessCount', () => {
	it('returns count of guesses', () => {
		const round: Round = {
			roundNumber: 1,
			photoId: 'photo1',
			photoOwnerId: 'player1',
			guesses: [
				{ playerId: 'player1', guessedOwnerId: 'player2', timestamp: 1500 },
				{ playerId: 'player2', guessedOwnerId: 'player1', timestamp: 1600 },
			],
			startTime: 1000,
		};

		expect(getGuessCount(round)).toBe(2);
	});

	it('returns 0 for no guesses', () => {
		const round: Round = {
			roundNumber: 1,
			photoId: 'photo1',
			photoOwnerId: 'player1',
			guesses: [],
			startTime: 1000,
		};

		expect(getGuessCount(round)).toBe(0);
	});
});

describe('hasPlayerGuessed', () => {
	const round: Round = {
		roundNumber: 1,
		photoId: 'photo1',
		photoOwnerId: 'player1',
		guesses: [{ playerId: 'player2', guessedOwnerId: 'player1', timestamp: 1500 }],
		startTime: 1000,
	};

	it('returns true if player has guessed', () => {
		expect(hasPlayerGuessed(round, 'player2')).toBe(true);
	});

	it('returns false if player has not guessed', () => {
		expect(hasPlayerGuessed(round, 'player1')).toBe(false);
	});
});

describe('getPlayerGuess', () => {
	const round: Round = {
		roundNumber: 1,
		photoId: 'photo1',
		photoOwnerId: 'player1',
		guesses: [{ playerId: 'player2', guessedOwnerId: 'player1', timestamp: 1500 }],
		startTime: 1000,
	};

	it('returns guess if player has guessed', () => {
		const guess = getPlayerGuess(round, 'player2');
		expect(guess).toBeDefined();
		expect(guess?.guessedOwnerId).toBe('player1');
	});

	it('returns undefined if player has not guessed', () => {
		const guess = getPlayerGuess(round, 'player1');
		expect(guess).toBeUndefined();
	});
});
