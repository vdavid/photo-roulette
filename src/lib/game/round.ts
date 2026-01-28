/**
 * Round management logic for Photo Roulette
 */

import type { Photo, PhotoPool, Round, RoundResult, PlayerId, Guess } from './types.js';
import { calculateRoundScores, findFastestCorrectGuesser } from './scoring.js';
import { random } from './random.js';

/**
 * Create an initial photo pool from all players' photos
 */
export function createPhotoPool(photos: Photo[]): PhotoPool {
	return {
		available: [...photos],
		used: [],
	};
}

/**
 * Select a random photo from the pool
 * Returns the selected photo and updated pool
 * If pool is exhausted, shuffles used photos back into available
 */
export function selectRandomPhoto(pool: PhotoPool): {
	photo: Photo;
	updatedPool: PhotoPool;
} | null {
	let available = [...pool.available];
	let used = [...pool.used];

	// If no photos available, recycle used photos
	if (available.length === 0) {
		if (used.length === 0) {
			return null; // No photos at all
		}
		available = shuffleArray(used);
		used = [];
	}

	// Select random photo
	const randomIndex = Math.floor(random() * available.length);
	const photo = available[randomIndex];

	// Remove from available, add to used
	available.splice(randomIndex, 1);
	used.push(photo);

	return {
		photo,
		updatedPool: {
			available,
			used,
		},
	};
}

/**
 * Select a photo fairly, ensuring roughly equal distribution among players.
 * Prioritizes players who have been featured fewer times.
 * The difference between any two players' feature counts should never exceed 1.
 */
export function selectFairPhoto(
	pool: PhotoPool,
	featureCounts: Map<PlayerId, number>
): {
	photo: Photo;
	updatedPool: PhotoPool;
} | null {
	let available = [...pool.available];
	let used = [...pool.used];

	// If no photos available, recycle used photos
	if (available.length === 0) {
		if (used.length === 0) {
			return null; // No photos at all
		}
		available = shuffleArray(used);
		used = [];
	}

	// Group available photos by owner
	const photosByOwner = new Map<PlayerId, Photo[]>();
	for (const photo of available) {
		const ownerPhotos = photosByOwner.get(photo.ownerId) || [];
		ownerPhotos.push(photo);
		photosByOwner.set(photo.ownerId, ownerPhotos);
	}

	// Find the minimum feature count among owners who have available photos
	let minCount = Infinity;
	for (const ownerId of photosByOwner.keys()) {
		const count = featureCounts.get(ownerId) || 0;
		if (count < minCount) {
			minCount = count;
		}
	}

	// Get all owners with the minimum count
	const eligibleOwners: PlayerId[] = [];
	for (const ownerId of photosByOwner.keys()) {
		const count = featureCounts.get(ownerId) || 0;
		if (count === minCount) {
			eligibleOwners.push(ownerId);
		}
	}

	// Pick a random eligible owner
	const selectedOwner = eligibleOwners[Math.floor(random() * eligibleOwners.length)];
	const ownerPhotos = photosByOwner.get(selectedOwner)!;

	// Pick a random photo from that owner
	const photo = ownerPhotos[Math.floor(random() * ownerPhotos.length)];

	// Remove from available, add to used
	const photoIndex = available.findIndex((p) => p.id === photo.id);
	available.splice(photoIndex, 1);
	used.push(photo);

	return {
		photo,
		updatedPool: {
			available,
			used,
		},
	};
}

/**
 * Fisher-Yates shuffle algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/**
 * Create a new round
 */
export function createRound(roundNumber: number, photo: Photo, startTime: number): Round {
	return {
		roundNumber,
		photoId: photo.id,
		photoOwnerId: photo.ownerId,
		guesses: [],
		startTime,
	};
}

/**
 * Add a guess to a round
 */
export function addGuess(round: Round, guess: Guess): Round {
	return {
		...round,
		guesses: [...round.guesses, guess],
	};
}

/**
 * Update a guess (player changed their mind)
 */
export function updateGuess(round: Round, guess: Guess): Round {
	const existingIndex = round.guesses.findIndex((g) => g.playerId === guess.playerId);

	if (existingIndex === -1) {
		return addGuess(round, guess);
	}

	const updatedGuesses = [...round.guesses];
	updatedGuesses[existingIndex] = guess;

	return {
		...round,
		guesses: updatedGuesses,
	};
}

/**
 * Complete a round and generate results
 */
export function completeRound(round: Round, playerIds: PlayerId[]): RoundResult {
	const scores = calculateRoundScores(playerIds, round.guesses, round.photoOwnerId);
	const fastestCorrectGuesserId = findFastestCorrectGuesser(round.guesses, round.photoOwnerId);

	return {
		roundNumber: round.roundNumber,
		photoId: round.photoId,
		photoOwnerId: round.photoOwnerId,
		guesses: round.guesses,
		scores,
		fastestCorrectGuesserId,
	};
}

/**
 * Check if all players have guessed
 */
export function allPlayersGuessed(round: Round, playerIds: PlayerId[]): boolean {
	const guessedPlayerIds = new Set(round.guesses.map((g) => g.playerId));
	return playerIds.every((id) => guessedPlayerIds.has(id));
}

/**
 * Get count of players who have guessed
 */
export function getGuessCount(round: Round): number {
	return round.guesses.length;
}

/**
 * Check if a specific player has guessed
 */
export function hasPlayerGuessed(round: Round, playerId: PlayerId): boolean {
	return round.guesses.some((g) => g.playerId === playerId);
}

/**
 * Get a player's current guess (if any)
 */
export function getPlayerGuess(round: Round, playerId: PlayerId): Guess | undefined {
	return round.guesses.find((g) => g.playerId === playerId);
}
