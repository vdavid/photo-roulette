/**
 * Room code generation and validation utilities
 * Shared across all games
 */

import { ROOM_CODE_CHARS, ROOM_CODE_LENGTH, getPeerIdPrefix } from './constants.js';

/**
 * Generate a random room code
 * Uses a set of unambiguous characters to avoid confusion (e.g., no 0/O, 1/I/L)
 */
export function generateRoomCode(): string {
	let code = '';
	for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
		const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
		code += ROOM_CODE_CHARS[randomIndex];
	}
	return code;
}

/**
 * Validate a room code format
 * Returns true if the code matches the expected format
 */
export function isValidRoomCode(code: string): boolean {
	if (code.length !== ROOM_CODE_LENGTH) {
		return false;
	}

	const upperCode = code.toUpperCase();
	for (const char of upperCode) {
		if (!ROOM_CODE_CHARS.includes(char)) {
			return false;
		}
	}

	return true;
}

/**
 * Normalize a room code (uppercase, trimmed)
 */
export function normalizeRoomCode(code: string): string {
	return code.trim().toUpperCase();
}

/**
 * Convert a room code to a PeerJS peer ID
 */
export function roomCodeToPeerId(roomCode: string): string {
	return `${getPeerIdPrefix()}${normalizeRoomCode(roomCode)}`;
}

/**
 * Extract room code from a PeerJS peer ID
 */
export function peerIdToRoomCode(peerId: string): string | null {
	const prefix = getPeerIdPrefix();
	if (!peerId.startsWith(prefix)) {
		return null;
	}
	return peerId.slice(prefix.length);
}
