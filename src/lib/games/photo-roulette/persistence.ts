/**
 * Session persistence for game state
 * Allows players to recover from accidental page refreshes
 */

import type { GamePhase, GameSettings, Player, PlayerId } from '$lib/game/types.js';
import { getLogger } from '$lib/common/logging.js';

const logger = getLogger(['persistence']);

const SESSION_KEY = 'photoroulette-session';

/** Persistable session data (excludes large photo data) */
export interface PersistedSession {
	version: number;
	timestamp: number;
	isHost: boolean;
	roomCode: string;
	myPlayerId: PlayerId;
	myName: string;
	myEmoji: string;
	phase: GamePhase;
	settings: GameSettings;
	players: Player[];
	hasConnectedPhotos: boolean;
	photoCount: number;
}

const CURRENT_VERSION = 1;
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Save session state to sessionStorage
 */
export function saveSession(session: Omit<PersistedSession, 'version' | 'timestamp'>): void {
	try {
		const data: PersistedSession = {
			...session,
			version: CURRENT_VERSION,
			timestamp: Date.now(),
		};
		sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
	} catch (error) {
		logger.warn`Failed to save session: ${error}`;
	}
}

/**
 * Load session state from sessionStorage
 * Returns null if no valid session exists
 */
export function loadSession(): PersistedSession | null {
	try {
		const raw = sessionStorage.getItem(SESSION_KEY);
		if (!raw) return null;

		const data: PersistedSession = JSON.parse(raw);

		// Check version compatibility
		if (data.version !== CURRENT_VERSION) {
			logger.warn`Session version mismatch, discarding`;
			clearSession();
			return null;
		}

		// Check if session is expired
		if (Date.now() - data.timestamp > SESSION_EXPIRY_MS) {
			logger.warn`Session expired, discarding`;
			clearSession();
			return null;
		}

		return data;
	} catch (error) {
		logger.warn`Failed to load session: ${error}`;
		clearSession();
		return null;
	}
}

/**
 * Clear the persisted session
 */
export function clearSession(): void {
	try {
		sessionStorage.removeItem(SESSION_KEY);
	} catch (error) {
		logger.warn`Failed to clear session: ${error}`;
	}
}

/**
 * Check if a session exists (without loading full data)
 */
export function hasSession(): boolean {
	try {
		return sessionStorage.getItem(SESSION_KEY) !== null;
	} catch {
		return false;
	}
}
