/**
 * Seeded random number generator for deterministic testing
 *
 * Uses a simple mulberry32 PRNG algorithm which is fast and has good statistical properties.
 * When a seed is set, all random operations become deterministic.
 */

/** The current seed (null means use Math.random) */
let currentSeed: number | null = null;

/** The current state of the PRNG */
let state: number = 0;

/**
 * Mulberry32 PRNG - fast, simple, good quality
 * https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */
function mulberry32(): number {
	state |= 0;
	state = (state + 0x6d2b79f5) | 0;
	let t = Math.imul(state ^ (state >>> 15), state | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Set the random seed for deterministic behavior
 * @param seed - The seed value (any integer). Pass null to use Math.random.
 */
export function setRandomSeed(seed: number | null): void {
	currentSeed = seed;
	if (seed !== null) {
		state = seed;
	}
}

/**
 * Get the current random seed (null if using Math.random)
 */
export function getRandomSeed(): number | null {
	return currentSeed;
}

/**
 * Reset the PRNG to its initial state with the current seed
 * Useful for replaying the same sequence of random numbers
 */
export function resetRandom(): void {
	if (currentSeed !== null) {
		state = currentSeed;
	}
}

/**
 * Get a random number between 0 (inclusive) and 1 (exclusive)
 * Uses the seeded PRNG if a seed is set, otherwise uses Math.random
 */
export function random(): number {
	if (currentSeed !== null) {
		return mulberry32();
	}
	return Math.random();
}

/**
 * Get a random integer between 0 (inclusive) and max (exclusive)
 */
export function randomInt(max: number): number {
	return Math.floor(random() * max);
}

/**
 * Pick a random element from an array
 */
export function randomElement<T>(array: T[]): T {
	return array[randomInt(array.length)];
}
