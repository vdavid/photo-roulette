/**
 * Logging configuration using logtape.
 *
 * Usage:
 *   import { getLogger } from '$lib/common/logging';
 *   const logger = getLogger(['photos', 'picker']);
 *   logger.info('Session created', { id: session.id });
 */

import { configure, getConsoleSink, getLogger as getLogtapeLogger } from '@logtape/logtape';

// Logger categories used in the app
export type LoggerCategory =
	| ['app']
	| ['networking']
	| ['networking', 'peer-manager']
	| ['networking', 'host']
	| ['networking', 'player']
	| ['photos']
	| ['photos', 'picker']
	| ['photos', 'processor']
	| ['persistence']
	| ['game', 'photo-roulette']
	| ['game', 'hot-takes'];

let configured = false;

/**
 * Configure logtape. Call this once at app startup.
 * Safe to call multiple times - will only configure once.
 */
export async function configureLogging(): Promise<void> {
	if (configured) return;

	await configure({
		sinks: {
			console: getConsoleSink(),
		},
		loggers: [
			{
				category: ['app'],
				lowestLevel: 'info',
				sinks: ['console'],
			},
			{
				category: ['networking'],
				lowestLevel: 'warning',
				sinks: ['console'],
			},
			{
				category: ['photos'],
				lowestLevel: 'debug',
				sinks: ['console'],
			},
			{
				category: ['persistence'],
				lowestLevel: 'warning',
				sinks: ['console'],
			},
			{
				category: ['game'],
				lowestLevel: 'warning',
				sinks: ['console'],
			},
		],
	});

	configured = true;
}

/**
 * Get a logger for the specified category.
 *
 * @param category - Array of category segments, e.g. ['photos', 'picker']
 * @returns A logger instance
 */
export function getLogger(category: LoggerCategory) {
	return getLogtapeLogger(category);
}
