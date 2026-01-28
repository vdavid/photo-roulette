<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';

	import GameSelector from '$lib/views/GameSelector.svelte';
	import { Spinner } from '$lib/common/components';
	import { isValidGameId, type GameId } from '$lib/common';

	// Photo Roulette game imports
	import {
		gameStore,
		Landing,
		Lobby,
		Game,
		Results,
		Final,
		MAX_PHOTOS_TO_PICK,
		isTestPlayer,
		ensureValidToken,
		openBlankPickerWindow,
		pickPhotos,
	} from '$lib/games/photo-roulette';

	// Hot Takes game imports
	import { Game as HotTakesGame, hotTakesStore } from '$lib/games/hot-takes';

	// Current selected game (from URL or state)
	let selectedGame = $state<GameId | null>(null);

	// Read game from URL on mount
	$effect(() => {
		if (browser) {
			const gameParam = $page.url.searchParams.get('game');
			if (gameParam && isValidGameId(gameParam)) {
				selectedGame = gameParam;
			}
		}
	});

	// Set up logging for debugging
	gameStore.setLogger((level, message, data) => {
		const timestamp = new Date().toISOString();
		const prefix = `[${timestamp}] [GAME] [${level.toUpperCase()}]`;
		if (data !== undefined) {
			console[level](`${prefix} ${message}`, data);
		} else {
			console[level](`${prefix} ${message}`);
		}
	});

	function handleSelectGame(gameId: string) {
		if (isValidGameId(gameId)) {
			selectedGame = gameId;
			// Update URL
			goto(`?game=${gameId}`, { replaceState: true });
		}
	}

	function handleBackToSelector() {
		// Leave game first if in one
		if (gameStore.phase !== 'landing') {
			gameStore.leaveGame();
		}
		selectedGame = null;
		goto('/', { replaceState: true });
	}

	// === Photo Roulette handlers ===

	async function handleHostGame(name: string, emoji: string) {
		await gameStore.hostGame(name, emoji);
	}

	async function handleJoinGame(code: string, name: string, emoji: string) {
		await gameStore.joinGame(code, name, emoji);
	}

	// Check for persisted session on load
	const persistedSession = gameStore.getPersistedSession();

	async function handleRestoreSession(
		session: NonNullable<ReturnType<typeof gameStore.getPersistedSession>>
	) {
		// If restoring session, make sure Photo Roulette is selected
		if (!selectedGame) {
			selectedGame = 'photo-roulette';
			goto('?game=photo-roulette', { replaceState: true });
		}
		return await gameStore.restoreAsPlayer(session);
	}

	function handleDismissSession() {
		gameStore.clearPersistedSession();
	}

	function handleUpdateName(name: string, emoji: string) {
		gameStore.updateMyInfo(name, emoji);
	}

	function handleUpdateSettings(settings: typeof gameStore.settings) {
		gameStore.updateGameSettings(settings);
	}

	async function handleConnectPhotos() {
		// For test players (AAA, BBB, etc.), skip the Google Photos flow entirely
		if (isTestPlayer(gameStore.myName)) {
			await gameStore.connectPhotos(async () => {
				return { photos: [] };
			});
			return;
		}

		// IMPORTANT: Open the picker window IMMEDIATELY during user gesture
		const pickerWindow = openBlankPickerWindow();
		if (!pickerWindow) {
			console.error('Popup blocked! Please allow popups for this site.');
			return;
		}

		try {
			const token = await ensureValidToken(PUBLIC_GOOGLE_CLIENT_ID);
			await gameStore.connectPhotos(async () => {
				return await pickPhotos(MAX_PHOTOS_TO_PICK, undefined, token, pickerWindow);
			});
		} catch (error) {
			console.error('Failed to connect photos:', error);
			pickerWindow.close();
		}
	}

	function handleStartGame() {
		gameStore.startGame();
	}

	function handleGuess(playerId: string) {
		gameStore.submitGuess(playerId);
	}

	function handleRematch() {
		gameStore.rematch();
	}

	function handleNewGame() {
		gameStore.newGame();
	}

	function handleLeaveGame() {
		gameStore.leaveGame();
	}

	// Get the latest round result for the results view
	const latestRoundResult = $derived(
		gameStore.roundResults.length > 0
			? gameStore.roundResults[gameStore.roundResults.length - 1]
			: null
	);

	// Compute page title
	const pageTitle = $derived.by(() => {
		if (!selectedGame) {
			return 'Party Games';
		}

		if (selectedGame === 'photo-roulette') {
			switch (gameStore.phase) {
				case 'lobby':
					return `Lobby - ${gameStore.roomCode} | Photo Roulette`;
				case 'playing':
					return `Round ${gameStore.currentRound?.roundNumber || ''} | Photo Roulette`;
				case 'results':
					return 'Results | Photo Roulette';
				case 'final':
					return 'Game Over! | Photo Roulette';
				default:
					return 'Photo Roulette';
			}
		}

		if (selectedGame === 'hot-takes') {
			switch (hotTakesStore.phase) {
				case 'lobby':
					return `Lobby - ${hotTakesStore.roomCode} | Hot Takes`;
				case 'submitting':
					return 'Submit your takes | Hot Takes';
				case 'voting':
					return 'Vote! | Hot Takes';
				case 'guessing':
					return 'Guess who! | Hot Takes';
				case 'reveal':
					return 'Reveal | Hot Takes';
				case 'final':
					return 'Game Over! | Hot Takes';
				default:
					return 'Hot Takes';
			}
		}

		return 'Party Games';
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#if !selectedGame}
	<!-- Game Selector -->
	<GameSelector onSelectGame={handleSelectGame} />
{:else if selectedGame === 'photo-roulette'}
	<!-- Photo Roulette Game -->
	{#if gameStore.connectionStatus === 'connecting'}
		<div class="loading-screen">
			<Spinner size="lg" />
			<p>Connecting...</p>
		</div>
	{:else if gameStore.phase === 'landing'}
		<Landing
			onHostGame={handleHostGame}
			onJoinGame={handleJoinGame}
			{persistedSession}
			onRestoreSession={handleRestoreSession}
			onDismissSession={handleDismissSession}
			onBackToMenu={handleBackToSelector}
		/>
	{:else if gameStore.phase === 'lobby'}
		<Lobby
			roomCode={gameStore.roomCode || ''}
			players={gameStore.players}
			settings={gameStore.settings}
			myPlayerId={gameStore.myPlayerId || ''}
			isHost={gameStore.isHost}
			isSpectator={gameStore.myPlayer?.isSpectator ?? false}
			hasConnectedPhotos={gameStore.hasConnectedPhotos}
			photoCount={gameStore.photoCount}
			isConnectingPhotos={gameStore.isConnectingPhotos}
			photoLoadingProgress={gameStore.photoLoadingProgress}
			canStartGame={gameStore.canStartGame}
			playersWithPhotosCount={gameStore.playersWithPhotosCount}
			onUpdateName={handleUpdateName}
			onUpdateSettings={handleUpdateSettings}
			onToggleSpectator={(isSpectator) => gameStore.setSpectatorMode(isSpectator)}
			onConnectPhotos={handleConnectPhotos}
			onStartGame={handleStartGame}
			onLeaveGame={handleLeaveGame}
			onKickPlayer={(playerId) => gameStore.kickPlayer(playerId)}
		/>
	{:else if gameStore.phase === 'playing' && gameStore.currentRound}
		<Game
			round={gameStore.currentRound}
			photoUrl={gameStore.currentPhotoUrl}
			players={gameStore.players}
			myGuess={gameStore.myGuess}
			guessCount={gameStore.guessCount}
			timerStartTime={gameStore.timerStartTime || Date.now()}
			timerEndTime={gameStore.timerEndTime || Date.now() + 10000}
			totalRounds={gameStore.settings.totalRounds}
			onGuess={handleGuess}
		/>
	{:else if gameStore.phase === 'results' && latestRoundResult}
		<Results
			result={latestRoundResult}
			players={gameStore.players}
			playerScores={gameStore.playerScores}
			currentRoundNumber={gameStore.roundResults.length}
			totalRounds={gameStore.settings.totalRounds}
			photoUrl={gameStore.resultsPhotoUrl}
		/>
	{:else if gameStore.phase === 'final' && gameStore.finalResults}
		<Final
			results={gameStore.finalResults}
			players={gameStore.players}
			isHost={gameStore.isHost}
			roundResults={gameStore.roundResults}
			gamePhotoUrls={gameStore.gamePhotoUrls}
			onRematch={handleRematch}
			onNewGame={handleNewGame}
			onLeaveGame={handleLeaveGame}
		/>
	{:else}
		<div class="loading-screen">
			<Spinner size="lg" />
			<p>Loading...</p>
		</div>
	{/if}
{:else if selectedGame === 'hot-takes'}
	<!-- Hot Takes Game -->
	<HotTakesGame onBackToMenu={handleBackToSelector} />
{/if}

<style>
	.loading-screen {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
	}

	.loading-screen p {
		color: var(--color-text-muted);
	}
</style>
