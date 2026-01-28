import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	setRandomSeed,
	clearRandomSeed,
	shuffleArray,
	shuffleTakes,
	getCurrentTake,
	getCurrentTakeFull,
	createInitialRound,
	setCurrentTake,
	advanceToNextTake,
	hasMoreTakes,
	getTakeProgress,
	createTakeResult,
	revealAuthor,
	getVoteBreakdown,
} from './round.js';
import type { HotTake, HotTakesGameState, Vote } from './types.js';
import { DEFAULT_HOT_TAKES_SETTINGS } from './types.js';

// Helper to create test state
function createTestState(overrides: Partial<HotTakesGameState> = {}): HotTakesGameState {
	return {
		phase: 'voting',
		settings: { ...DEFAULT_HOT_TAKES_SETTINGS },
		players: [
			{
				id: 'p1',
				name: 'Player 1',
				emoji: '🐰',
				isReady: true,
				isSpectator: false,
				takeIds: ['t1'],
				isConnected: true,
			},
			{
				id: 'p2',
				name: 'Player 2',
				emoji: '🦊',
				isReady: true,
				isSpectator: false,
				takeIds: ['t2'],
				isConnected: true,
			},
		],
		takes: [
			{ id: 't1', text: 'Take 1', authorId: 'p1' },
			{ id: 't2', text: 'Take 2', authorId: 'p2' },
		],
		currentRound: {
			takeIndex: 0,
			currentTake: { id: 't1', text: 'Take 1' },
			phaseStartTime: Date.now(),
			votes: [],
			guesses: [],
		},
		takeResults: [],
		playerScores: new Map(),
		...overrides,
	};
}

describe('shuffleArray', () => {
	beforeEach(() => {
		setRandomSeed(12345);
	});

	afterEach(() => {
		clearRandomSeed();
	});

	it('should return array with same elements', () => {
		const original = [1, 2, 3, 4, 5];
		const shuffled = shuffleArray(original);

		expect(shuffled).toHaveLength(original.length);
		expect(shuffled.sort()).toEqual(original.sort());
	});

	it('should not modify original array', () => {
		const original = [1, 2, 3, 4, 5];
		const copy = [...original];
		shuffleArray(original);

		expect(original).toEqual(copy);
	});

	it('should be deterministic with seed', () => {
		setRandomSeed(12345);
		const first = shuffleArray([1, 2, 3, 4, 5]);

		setRandomSeed(12345);
		const second = shuffleArray([1, 2, 3, 4, 5]);

		expect(first).toEqual(second);
	});
});

describe('shuffleTakes', () => {
	beforeEach(() => {
		setRandomSeed(12345);
	});

	afterEach(() => {
		clearRandomSeed();
	});

	it('should shuffle takes while preserving all data', () => {
		const takes: HotTake[] = [
			{ id: 't1', text: 'Take 1', authorId: 'p1' },
			{ id: 't2', text: 'Take 2', authorId: 'p2' },
			{ id: 't3', text: 'Take 3', authorId: 'p3' },
		];

		const shuffled = shuffleTakes(takes);

		expect(shuffled).toHaveLength(3);
		// All original takes should still be present
		for (const take of takes) {
			expect(shuffled.find((t) => t.id === take.id)).toBeDefined();
		}
	});
});

describe('getCurrentTake', () => {
	it('should return current take without author', () => {
		const state = createTestState();
		const take = getCurrentTake(state);

		expect(take).toEqual({ id: 't1', text: 'Take 1' });
		expect(take).not.toHaveProperty('authorId');
	});

	it('should return null if no current round', () => {
		const state = createTestState({ currentRound: null });
		expect(getCurrentTake(state)).toBeNull();
	});

	it('should return null if takeIndex out of bounds', () => {
		const state = createTestState({
			currentRound: {
				takeIndex: 10, // Out of bounds
				currentTake: null,
				phaseStartTime: Date.now(),
				votes: [],
				guesses: [],
			},
		});
		expect(getCurrentTake(state)).toBeNull();
	});
});

describe('getCurrentTakeFull', () => {
	it('should return current take with author', () => {
		const state = createTestState();
		const take = getCurrentTakeFull(state);

		expect(take).toEqual({ id: 't1', text: 'Take 1', authorId: 'p1' });
	});

	it('should return null if no current round', () => {
		const state = createTestState({ currentRound: null });
		expect(getCurrentTakeFull(state)).toBeNull();
	});
});

describe('createInitialRound', () => {
	it('should create round with index 0 and empty arrays', () => {
		const round = createInitialRound();

		expect(round.takeIndex).toBe(0);
		expect(round.currentTake).toBeNull();
		expect(round.votes).toEqual([]);
		expect(round.guesses).toEqual([]);
		expect(round.phaseStartTime).toBeGreaterThan(0);
	});
});

describe('setCurrentTake', () => {
	it('should set current take and reset phase start time', () => {
		const round = createInitialRound();
		const take = { id: 't1', text: 'Test take' };

		const newRound = setCurrentTake(round, take);

		expect(newRound.currentTake).toEqual(take);
		expect(newRound.phaseStartTime).toBeGreaterThan(0);
	});
});

describe('advanceToNextTake', () => {
	it('should advance to next take', () => {
		const state = createTestState();
		const newRound = advanceToNextTake(state);

		expect(newRound).not.toBeNull();
		expect(newRound!.takeIndex).toBe(1);
		expect(newRound!.currentTake).toEqual({ id: 't2', text: 'Take 2' });
		expect(newRound!.votes).toEqual([]);
		expect(newRound!.guesses).toEqual([]);
	});

	it('should return null when all takes processed', () => {
		const state = createTestState({
			currentRound: {
				takeIndex: 1, // Already on last take
				currentTake: { id: 't2', text: 'Take 2' },
				phaseStartTime: Date.now(),
				votes: [],
				guesses: [],
			},
		});

		const newRound = advanceToNextTake(state);
		expect(newRound).toBeNull();
	});

	it('should return null if no current round', () => {
		const state = createTestState({ currentRound: null });
		expect(advanceToNextTake(state)).toBeNull();
	});
});

describe('hasMoreTakes', () => {
	it('should return true if more takes remain', () => {
		const state = createTestState();
		expect(hasMoreTakes(state)).toBe(true);
	});

	it('should return false if on last take', () => {
		const state = createTestState({
			currentRound: {
				takeIndex: 1,
				currentTake: { id: 't2', text: 'Take 2' },
				phaseStartTime: Date.now(),
				votes: [],
				guesses: [],
			},
		});

		expect(hasMoreTakes(state)).toBe(false);
	});

	it('should return true if has takes but no round started', () => {
		const state = createTestState({ currentRound: null });
		expect(hasMoreTakes(state)).toBe(true);
	});

	it('should return false if no takes', () => {
		const state = createTestState({ takes: [], currentRound: null });
		expect(hasMoreTakes(state)).toBe(false);
	});
});

describe('getTakeProgress', () => {
	it('should return correct progress', () => {
		const state = createTestState();
		const progress = getTakeProgress(state);

		expect(progress.current).toBe(1); // takeIndex 0 + 1
		expect(progress.total).toBe(2);
	});

	it('should return 0 current if no round', () => {
		const state = createTestState({ currentRound: null });
		const progress = getTakeProgress(state);

		expect(progress.current).toBe(0);
		expect(progress.total).toBe(2);
	});
});

describe('createTakeResult', () => {
	it('should create result from current round data', () => {
		const state = createTestState({
			currentRound: {
				takeIndex: 0,
				currentTake: { id: 't1', text: 'Take 1' },
				phaseStartTime: Date.now(),
				votes: [
					{ playerId: 'p1', takeId: 't1', vote: 'agree' },
					{ playerId: 'p2', takeId: 't1', vote: 'disagree' },
				],
				guesses: [{ playerId: 'p2', takeId: 't1', guessedAuthorId: 'p1' }],
			},
		});

		const result = createTakeResult(state);

		expect(result).not.toBeNull();
		expect(result!.takeId).toBe('t1');
		expect(result!.authorId).toBe('p1');
		expect(result!.votes).toHaveLength(2);
		expect(result!.guesses).toHaveLength(1);
		expect(result!.agreePercent).toBe(50);
		expect(result!.isControversial).toBe(true);
	});

	it('should return null if no current round', () => {
		const state = createTestState({ currentRound: null });
		expect(createTakeResult(state)).toBeNull();
	});

	it('should return null if no current take', () => {
		const state = createTestState({
			currentRound: {
				takeIndex: 0,
				currentTake: null,
				phaseStartTime: Date.now(),
				votes: [],
				guesses: [],
			},
		});

		expect(createTakeResult(state)).toBeNull();
	});
});

describe('revealAuthor', () => {
	it('should return author info for a take', () => {
		const state = createTestState();
		const revealed = revealAuthor(state, 't1');

		expect(revealed).not.toBeNull();
		expect(revealed!.take).toEqual({ id: 't1', text: 'Take 1', authorId: 'p1' });
		expect(revealed!.authorName).toBe('Player 1');
		expect(revealed!.authorEmoji).toBe('🐰');
	});

	it('should return null for unknown take', () => {
		const state = createTestState();
		expect(revealAuthor(state, 'unknown')).toBeNull();
	});
});

describe('getVoteBreakdown', () => {
	it('should calculate vote breakdown correctly', () => {
		const votes: Vote[] = [
			{ playerId: 'p1', takeId: 't1', vote: 'agree' },
			{ playerId: 'p2', takeId: 't1', vote: 'agree' },
			{ playerId: 'p3', takeId: 't1', vote: 'disagree' },
		];

		const breakdown = getVoteBreakdown(votes);

		expect(breakdown.agreeCount).toBe(2);
		expect(breakdown.disagreeCount).toBe(1);
		expect(breakdown.agreePercent).toBe(67); // 2/3 rounded
		expect(breakdown.disagreePercent).toBe(33);
	});

	it('should handle empty votes', () => {
		const breakdown = getVoteBreakdown([]);

		expect(breakdown.agreeCount).toBe(0);
		expect(breakdown.disagreeCount).toBe(0);
		expect(breakdown.agreePercent).toBe(50);
		expect(breakdown.disagreePercent).toBe(50);
	});

	it('should handle unanimous agree', () => {
		const votes: Vote[] = [
			{ playerId: 'p1', takeId: 't1', vote: 'agree' },
			{ playerId: 'p2', takeId: 't1', vote: 'agree' },
		];

		const breakdown = getVoteBreakdown(votes);

		expect(breakdown.agreePercent).toBe(100);
		expect(breakdown.disagreePercent).toBe(0);
	});

	it('should handle unanimous disagree', () => {
		const votes: Vote[] = [
			{ playerId: 'p1', takeId: 't1', vote: 'disagree' },
			{ playerId: 'p2', takeId: 't1', vote: 'disagree' },
		];

		const breakdown = getVoteBreakdown(votes);

		expect(breakdown.agreePercent).toBe(0);
		expect(breakdown.disagreePercent).toBe(100);
	});
});
