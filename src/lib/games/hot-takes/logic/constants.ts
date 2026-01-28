/**
 * Hot Takes game constants
 */

/** Points awarded for correctly guessing who wrote a take */
export const CORRECT_GUESS_POINTS = 100;

/** Points awarded for having a controversial take (40-60% vote split) */
export const CONTROVERSIAL_TAKE_POINTS = 50;

/** Points awarded for a unanimous take (everyone agrees or disagrees) */
export const UNANIMOUS_TAKE_POINTS = 10;

/** Lower bound for controversial vote percentage (inclusive) */
export const CONTROVERSIAL_MIN_PERCENT = 40;

/** Upper bound for controversial vote percentage (inclusive) */
export const CONTROVERSIAL_MAX_PERCENT = 60;

/** Available voting time options in seconds */
export const VOTING_TIME_OPTIONS = [10, 15, 20, 30] as const;

/** Available guessing time options in seconds */
export const GUESSING_TIME_OPTIONS = [15, 20, 30, 45] as const;

/** Available takes per player options */
export const TAKES_PER_PLAYER_OPTIONS = [1, 2, 3] as const;

/** Minimum number of players required to start */
export const MIN_PLAYERS = 3;

/** Maximum number of players allowed */
export const MAX_PLAYERS = 8;

/** Maximum character length for a hot take */
export const MAX_TAKE_LENGTH = 280;

/** Minimum character length for a hot take */
export const MIN_TAKE_LENGTH = 10;

/** Time to show results before auto-advancing (milliseconds) */
export const REVEAL_DISPLAY_MS = 5000;

/** Time to show final results (milliseconds) */
export const FINAL_DISPLAY_MS = 10000;
