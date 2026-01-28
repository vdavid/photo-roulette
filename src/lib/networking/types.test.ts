/**
 * Tests for networking type helpers
 */

import { describe, it, expect } from 'vitest';
import type { PlayerScore } from '../game/types.js';
import {
	createBaseMessage,
	playerScoresToData,
	dataToPlayerScores,
	type PlayerScoreData,
} from './types.js';

describe('createBaseMessage', () => {
	it('creates a message with correct type and sender', () => {
		const message = createBaseMessage('ping', 'player-123');

		expect(message.type).toBe('ping');
		expect(message.senderId).toBe('player-123');
		expect(typeof message.timestamp).toBe('number');
	});

	it('uses current time for timestamp', () => {
		const before = Date.now();
		const message = createBaseMessage('pong', 'player-456');
		const after = Date.now();

		expect(message.timestamp).toBeGreaterThanOrEqual(before);
		expect(message.timestamp).toBeLessThanOrEqual(after);
	});
});

describe('playerScoresToData', () => {
	it('converts Map to array', () => {
		const scores = new Map<string, PlayerScore>([
			[
				'player-1',
				{
					playerId: 'player-1',
					totalPoints: 500,
					correctGuesses: 4,
					fastestGuesses: 2,
					timesFeatured: 1,
				},
			],
			[
				'player-2',
				{
					playerId: 'player-2',
					totalPoints: 350,
					correctGuesses: 3,
					fastestGuesses: 1,
					timesFeatured: 0,
				},
			],
		]);

		const data = playerScoresToData(scores);

		expect(data).toHaveLength(2);
		expect(data).toContainEqual({
			playerId: 'player-1',
			totalPoints: 500,
			correctGuesses: 4,
			fastestGuesses: 2,
			timesFeatured: 1,
		});
		expect(data).toContainEqual({
			playerId: 'player-2',
			totalPoints: 350,
			correctGuesses: 3,
			fastestGuesses: 1,
			timesFeatured: 0,
		});
	});

	it('handles empty Map', () => {
		const scores = new Map<string, PlayerScore>();
		const data = playerScoresToData(scores);
		expect(data).toEqual([]);
	});
});

describe('dataToPlayerScores', () => {
	it('converts array to Map', () => {
		const data: PlayerScoreData[] = [
			{
				playerId: 'player-1',
				totalPoints: 500,
				correctGuesses: 4,
				fastestGuesses: 2,
				timesFeatured: 1,
			},
			{
				playerId: 'player-2',
				totalPoints: 350,
				correctGuesses: 3,
				fastestGuesses: 1,
				timesFeatured: 0,
			},
		];

		const scores = dataToPlayerScores(data);

		expect(scores.size).toBe(2);
		expect(scores.get('player-1')).toEqual({
			playerId: 'player-1',
			totalPoints: 500,
			correctGuesses: 4,
			fastestGuesses: 2,
			timesFeatured: 1,
		});
		expect(scores.get('player-2')).toEqual({
			playerId: 'player-2',
			totalPoints: 350,
			correctGuesses: 3,
			fastestGuesses: 1,
			timesFeatured: 0,
		});
	});

	it('handles empty array', () => {
		const scores = dataToPlayerScores([]);
		expect(scores.size).toBe(0);
	});
});

describe('round trip conversion', () => {
	it('preserves data through Map->Array->Map conversion', () => {
		const original = new Map<string, PlayerScore>([
			[
				'player-1',
				{
					playerId: 'player-1',
					totalPoints: 1000,
					correctGuesses: 10,
					fastestGuesses: 5,
					timesFeatured: 3,
				},
			],
		]);

		const data = playerScoresToData(original);
		const restored = dataToPlayerScores(data);

		expect(restored.get('player-1')).toEqual(original.get('player-1'));
	});
});
