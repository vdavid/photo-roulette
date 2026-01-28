/**
 * Photo Roulette networking exports
 */

export { PhotoRouletteHost, type PhotoRouletteHostEvents } from './host.js';
export { PhotoRoulettePlayer, type PhotoRoulettePlayerEvents } from './player.js';

export type {
	PhotoRouletteMessageType,
	PhotoRouletteMessage,
	PlayerJoinAcceptedMessage,
	PlayerUpdateMessage,
	PhotosSubmittedMessage,
	SettingsChangedMessage,
	GameStartingMessage,
	RoundStartMessage,
	GuessSubmittedMessage,
	RoundEndMessage,
	GameEndMessage,
	StateSyncMessage,
	PlayerScoreData,
} from './types.js';

export { playerScoresToData, dataToPlayerScores } from './types.js';
