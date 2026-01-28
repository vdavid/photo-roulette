<script lang="ts">
	import { Button, Card, Input, EmojiPicker } from '$lib/common/components';
	import { type AnimalEmoji, ANIMAL_EMOJIS } from '$lib/common/types.js';
	import PlayerCard from '../components/PlayerCard.svelte';
	import type { Player, GameSettings } from '../logic/types.js';
	import { ROUND_OPTIONS, TIMER_OPTIONS, MIN_PHOTOS_PER_PLAYER } from '../logic/constants.js';

	interface Props {
		roomCode: string;
		players: Player[];
		settings: GameSettings;
		myPlayerId: string;
		isHost: boolean;
		isSpectator: boolean;
		hasConnectedPhotos: boolean;
		photoCount: number;
		isConnectingPhotos: boolean;
		photoLoadingProgress: { loaded: number; total: number } | null;
		canStartGame: boolean;
		playersWithPhotosCount: number;
		onUpdateName: (_name: string, _emoji: string) => void;
		onUpdateSettings: (_settings: GameSettings) => void;
		onToggleSpectator: (_isSpectator: boolean) => void;
		onConnectPhotos: () => void;
		onStartGame: () => void;
		onLeaveGame: () => void;
		onKickPlayer?: (_playerId: string) => void;
	}

	let {
		roomCode,
		players,
		settings,
		myPlayerId,
		isHost,
		isSpectator,
		hasConnectedPhotos,
		photoCount,
		isConnectingPhotos,
		photoLoadingProgress,
		canStartGame,
		playersWithPhotosCount,
		onUpdateName,
		onUpdateSettings,
		onToggleSpectator,
		onConnectPhotos,
		onStartGame,
		onLeaveGame,
		onKickPlayer,
	}: Props = $props();

	let showSettings = $state(false);
	let editedName = $state('');
	let editedEmoji = $state<AnimalEmoji>(ANIMAL_EMOJIS[0]);
	let copied = $state(false);

	const myPlayer = $derived(players.find((p) => p.id === myPlayerId));

	// Initialize edit fields from player
	$effect(() => {
		if (myPlayer && !editedName) {
			editedName = myPlayer.name;
			editedEmoji = myPlayer.emoji as AnimalEmoji;
		}
	});

	function handleCopyCode() {
		navigator.clipboard.writeText(roomCode);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function handleNameChange() {
		if (editedName.trim() && (editedName !== myPlayer?.name || editedEmoji !== myPlayer?.emoji)) {
			onUpdateName(editedName.trim(), editedEmoji);
		}
	}

	function handleRoundsChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		onUpdateSettings({ ...settings, totalRounds: parseInt(target.value) });
	}

	function handleTimerChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		onUpdateSettings({ ...settings, timerSeconds: parseInt(target.value) });
	}

	const settingsLabel = $derived(`${settings.totalRounds} rounds • ${settings.timerSeconds}s`);
</script>

<div class="lobby">
	<header class="header">
		<div class="room-info">
			<span class="room-label">Room code</span>
			<button class="room-code" onclick={handleCopyCode} title="Click to copy">
				<span class="code">{roomCode}</span>
				<span class="copy-icon">{copied ? '✓' : '📋'}</span>
			</button>
		</div>

		<button class="settings-chip" onclick={() => (showSettings = !showSettings)} disabled={!isHost}>
			{settingsLabel}
			{#if isHost}
				<span class="edit-icon">⚙️</span>
			{/if}
		</button>
	</header>

	{#if showSettings && isHost}
		<Card padding="sm">
			<div class="settings-panel">
				<div class="setting">
					<label for="rounds">Rounds</label>
					<select id="rounds" value={settings.totalRounds} onchange={handleRoundsChange}>
						{#each ROUND_OPTIONS as option}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</div>
				<div class="setting">
					<label for="timer">Timer (seconds)</label>
					<select id="timer" value={settings.timerSeconds} onchange={handleTimerChange}>
						{#each TIMER_OPTIONS as option}
							<option value={option}>{option}s</option>
						{/each}
					</select>
				</div>
			</div>
		</Card>
	{/if}

	<section class="players-section">
		<h2>Players ({players.length}/8)</h2>
		<div class="players-list">
			{#each players as player (player.id)}
				<PlayerCard
					{player}
					isCurrentPlayer={player.id === myPlayerId}
					canKick={isHost && !player.isHost}
					onKick={onKickPlayer ? () => onKickPlayer(player.id) : undefined}
				/>
			{/each}
		</div>
	</section>

	<Card>
		<div class="profile-section">
			<h3>Your profile</h3>

			<div class="profile-fields">
				<div class="name-field">
					<Input
						bind:value={editedName}
						placeholder="Your name"
						maxlength={20}
						onchange={handleNameChange}
					/>
				</div>
				<EmojiPicker
					selected={editedEmoji}
					onselect={(e) => {
						editedEmoji = e;
						handleNameChange();
					}}
				/>
			</div>
		</div>
	</Card>

	<Card>
		{#if isSpectator}
			<div class="spectator-section">
				<h3>Spectator mode</h3>
				<p class="spectator-info">
					You're watching this game without contributing photos. You can still guess and earn
					points!
				</p>
				<div class="spectator-badge">
					<span class="badge-icon">👁️</span>
					<span>Spectating</span>
				</div>
				<Button variant="secondary" onclick={() => onToggleSpectator(false)}>Join as player</Button>
			</div>
		{:else}
			<div class="photos-section">
				<h3>Your photos</h3>

				{#if hasConnectedPhotos}
					<div class="photos-status success">
						<span class="status-icon">✓</span>
						<span>{photoCount} photos connected</span>
					</div>
					<Button variant="secondary" onclick={onConnectPhotos} disabled={isConnectingPhotos}>
						{isConnectingPhotos ? 'Connecting...' : 'Change photos'}
					</Button>
				{:else if photoLoadingProgress}
					<div class="photos-loading">
						<p class="photos-loading-text">
							Loading your {photoLoadingProgress.total} selected photos...
						</p>
						<div class="photos-loading-progress">
							<span class="progress-count"
								>{photoLoadingProgress.loaded} of {photoLoadingProgress.total}</span
							>
							<div class="progress-bar">
								<div
									class="progress-fill"
									style="width: {(photoLoadingProgress.loaded / photoLoadingProgress.total) * 100}%"
								></div>
							</div>
						</div>
					</div>
				{:else}
					<p class="photos-hint">
						Connect at least {MIN_PHOTOS_PER_PLAYER} photos from Google Photos to play.
					</p>
					<Button onclick={onConnectPhotos} loading={isConnectingPhotos} fullWidth>
						{isConnectingPhotos ? 'Connecting...' : 'Connect your photos'}
					</Button>
					<Button variant="ghost" onclick={() => onToggleSpectator(true)} fullWidth>
						Just watch (spectator mode)
					</Button>
				{/if}
			</div>
		{/if}
	</Card>

	<footer class="footer">
		{#if isHost}
			<Button size="lg" fullWidth onclick={onStartGame} disabled={!canStartGame}>
				{#if canStartGame}
					Start game
				{:else if playersWithPhotosCount < 2}
					Need {2 - playersWithPhotosCount} more player{playersWithPhotosCount === 1 ? '' : 's'} with
					photos
				{:else}
					Waiting for players...
				{/if}
			</Button>
		{:else}
			<div class="waiting-message">
				<span class="waiting-dot"></span>
				Waiting for host to start...
			</div>
		{/if}

		<Button variant="ghost" onclick={onLeaveGame}>Leave game</Button>
	</footer>
</div>

<style>
	.lobby {
		min-height: 100vh;
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		max-width: 600px;
		margin: 0 auto;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-md);
		flex-wrap: wrap;
	}

	.room-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.room-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.room-code {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-family: inherit;
		transition: background var(--transition-fast);
	}

	.room-code:hover {
		background: var(--color-secondary);
	}

	.code {
		font-size: var(--font-size-xl);
		font-weight: 600;
		letter-spacing: 0.1em;
	}

	.copy-icon {
		font-size: 1.25rem;
	}

	.settings-chip {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-secondary);
		border: none;
		border-radius: var(--radius-full);
		font-family: inherit;
		font-size: var(--font-size-sm);
		color: var(--color-text);
		cursor: pointer;
		transition: opacity var(--transition-fast);
	}

	.settings-chip:disabled {
		cursor: default;
		color: var(--color-text);
		opacity: 1;
	}

	.settings-chip:not(:disabled):hover {
		opacity: 0.9;
	}

	.settings-panel {
		display: flex;
		gap: var(--space-lg);
	}

	.setting {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.setting label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.setting select {
		padding: var(--space-sm);
		border: 2px solid var(--color-background);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		font-family: inherit;
		cursor: pointer;
	}

	.players-section h2 {
		font-size: var(--font-size-lg);
		margin: 0 0 var(--space-md);
	}

	.players-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.profile-section,
	.photos-section,
	.spectator-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.profile-section h3,
	.photos-section h3,
	.spectator-section h3 {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.spectator-info {
		color: var(--color-text-muted);
		margin: 0;
	}

	.spectator-badge {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-secondary);
	}

	.badge-icon {
		font-size: 1.25rem;
	}

	.profile-fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.name-field {
		max-width: 200px;
	}

	.photos-status {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-md);
		border-radius: var(--radius-sm);
		background: rgba(91, 140, 90, 0.1);
	}

	.photos-status.success {
		color: var(--color-success);
	}

	.status-icon {
		font-size: 1.25rem;
	}

	.photos-hint {
		color: var(--color-text-muted);
		margin: 0;
	}

	.photos-loading {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.photos-loading-text {
		margin: 0;
		color: var(--color-text-muted);
	}

	.photos-loading-progress {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.progress-count {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.progress-bar {
		height: 8px;
		background: var(--color-background);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--color-primary);
		border-radius: var(--radius-full);
		transition: width 200ms ease-out;
	}

	.footer {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		margin-top: auto;
		padding-top: var(--space-lg);
	}

	.waiting-message {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-md);
		color: var(--color-text-muted);
	}

	.waiting-dot {
		width: 8px;
		height: 8px;
		background: var(--color-secondary);
		border-radius: 50%;
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
