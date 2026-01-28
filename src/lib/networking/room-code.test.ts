/**
 * Tests for room code utilities
 */

import { describe, it, expect } from 'vitest';
import {
	generateRoomCode,
	isValidRoomCode,
	normalizeRoomCode,
	roomCodeToPeerId,
	peerIdToRoomCode,
} from './room-code.js';
import { ROOM_CODE_CHARS, ROOM_CODE_LENGTH, PEER_ID_PREFIX } from './constants.js';

describe('generateRoomCode', () => {
	it('generates a code of correct length', () => {
		const code = generateRoomCode();
		expect(code.length).toBe(ROOM_CODE_LENGTH);
	});

	it('generates only valid characters', () => {
		// Generate many codes to test randomness
		for (let i = 0; i < 100; i++) {
			const code = generateRoomCode();
			for (const char of code) {
				expect(ROOM_CODE_CHARS).toContain(char);
			}
		}
	});

	it('generates different codes (not always the same)', () => {
		const codes = new Set<string>();
		for (let i = 0; i < 50; i++) {
			codes.add(generateRoomCode());
		}
		// With 4-char codes from ~30 chars, we should get mostly unique codes
		expect(codes.size).toBeGreaterThan(40);
	});
});

describe('isValidRoomCode', () => {
	it('accepts valid codes', () => {
		expect(isValidRoomCode('ABCD')).toBe(true);
		expect(isValidRoomCode('X7K2')).toBe(true);
		expect(isValidRoomCode('ZZZZ')).toBe(true);
		expect(isValidRoomCode('2222')).toBe(true);
	});

	it('rejects codes with wrong length', () => {
		expect(isValidRoomCode('')).toBe(false);
		expect(isValidRoomCode('ABC')).toBe(false);
		expect(isValidRoomCode('ABCDE')).toBe(false);
		expect(isValidRoomCode('ABCDEFGH')).toBe(false);
	});

	it('rejects codes with invalid characters', () => {
		// 0, O, 1, I, L are excluded to avoid ambiguity
		expect(isValidRoomCode('ABC0')).toBe(false);
		expect(isValidRoomCode('ABCO')).toBe(false);
		expect(isValidRoomCode('ABC1')).toBe(false);
		expect(isValidRoomCode('ABCI')).toBe(false);
		expect(isValidRoomCode('ABCL')).toBe(false);
	});

	it('accepts lowercase (case insensitive)', () => {
		expect(isValidRoomCode('abcd')).toBe(true);
		expect(isValidRoomCode('x7k2')).toBe(true);
	});

	it('rejects special characters', () => {
		expect(isValidRoomCode('ABC!')).toBe(false);
		expect(isValidRoomCode('AB-C')).toBe(false);
		expect(isValidRoomCode('AB C')).toBe(false);
	});
});

describe('normalizeRoomCode', () => {
	it('converts to uppercase', () => {
		expect(normalizeRoomCode('abcd')).toBe('ABCD');
		expect(normalizeRoomCode('x7k2')).toBe('X7K2');
	});

	it('trims whitespace', () => {
		expect(normalizeRoomCode('  ABCD  ')).toBe('ABCD');
		expect(normalizeRoomCode('\tX7K2\n')).toBe('X7K2');
	});

	it('handles mixed case and whitespace', () => {
		expect(normalizeRoomCode('  aBcD  ')).toBe('ABCD');
	});
});

describe('roomCodeToPeerId', () => {
	it('adds prefix to room code', () => {
		expect(roomCodeToPeerId('X7K2')).toBe(`${PEER_ID_PREFIX}X7K2`);
	});

	it('normalizes the room code', () => {
		expect(roomCodeToPeerId('x7k2')).toBe(`${PEER_ID_PREFIX}X7K2`);
		expect(roomCodeToPeerId('  x7k2  ')).toBe(`${PEER_ID_PREFIX}X7K2`);
	});
});

describe('peerIdToRoomCode', () => {
	it('extracts room code from peer ID', () => {
		expect(peerIdToRoomCode(`${PEER_ID_PREFIX}X7K2`)).toBe('X7K2');
		expect(peerIdToRoomCode(`${PEER_ID_PREFIX}ABCD`)).toBe('ABCD');
	});

	it('returns null for invalid peer IDs', () => {
		expect(peerIdToRoomCode('X7K2')).toBe(null);
		expect(peerIdToRoomCode('wrongprefix-X7K2')).toBe(null);
		expect(peerIdToRoomCode('')).toBe(null);
	});
});

describe('round trip', () => {
	it('converts room code to peer ID and back', () => {
		const roomCode = generateRoomCode();
		const peerId = roomCodeToPeerId(roomCode);
		const extractedCode = peerIdToRoomCode(peerId);
		expect(extractedCode).toBe(roomCode);
	});
});
