/**
 * Game constants for Photo Roulette
 */

import type { AnimalEmoji, GameSettings } from './types.js';

// === Scoring ===

/** Base points awarded for a correct guess (round 1) */
export const POINTS_CORRECT_GUESS_BASE = 63;

/** Additional points per round for correct guesses */
export const POINTS_CORRECT_GUESS_INCREMENT = 2;

/** Points subtracted when correctly guessing your own photo */
export const POINTS_OWN_PHOTO_PENALTY = 22;

/** Bonus points for being the fastest correct guesser */
export const POINTS_FASTEST_BONUS = 28;

/** Points awarded to the player whose photo was featured */
export const POINTS_FEATURED = 33;

// === Timing ===

/** Available timer options in seconds */
export const TIMER_OPTIONS = [5, 10, 15, 20] as const;

/** Default timer duration in seconds */
export const DEFAULT_TIMER_SECONDS = 20;

/** Duration of the progressive blur reveal in milliseconds */
export const BLUR_REVEAL_DURATION_MS = 3000;

/** Duration to show round results before auto-advancing in milliseconds */
export const ROUND_RESULT_DISPLAY_MS = 5500;

/** Buffer time in ms to sync round start across all players (accounts for network latency) */
export const ROUND_SYNC_BUFFER_MS = 200;

// === Rounds ===

/** Available round count options */
export const ROUND_OPTIONS = [8, 12, 16, 20] as const;

/** Default number of rounds */
export const DEFAULT_ROUNDS = 12;

// === Players ===

/** Maximum number of players (1 host + 7 players) */
export const MAX_PLAYERS = 8;

/** Minimum number of photos required per player */
export const MIN_PHOTOS_PER_PLAYER = 15;

/** Maximum number of photos the user can pick from Google Photos */
export const MAX_PHOTOS_TO_PICK = 50;

// === Default Settings ===

/** Default game settings */
export const DEFAULT_GAME_SETTINGS: GameSettings = {
	totalRounds: DEFAULT_ROUNDS,
	timerSeconds: DEFAULT_TIMER_SECONDS,
};

// === Emoji ===

/** Curated animal emoji set for player identification */
export const ANIMAL_EMOJIS: AnimalEmoji[] = [
	'🐰',
	'🐇',
	'🦊',
	'🐻',
	'🦉',
	'🦌',
	'🐿️',
	'🦝',
	'🐺',
	'🦎',
	'🐢',
	'🦋',
	'🐝',
	'🦔',
	'🐧',
	'🦜',
	'🐙',
	'🦀',
	'🐬',
	'🦭',
];

// === Photo URLs ===

/** Duration in minutes that Google Photos URLs are valid */
export const PHOTO_URL_VALIDITY_MINUTES = 60;
