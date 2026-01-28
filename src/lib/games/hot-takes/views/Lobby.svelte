<script lang="ts">
	import { Button, Card } from '$lib/common/components';
	import { hotTakesStore } from '../store.svelte.js';
	import {
		MIN_PLAYERS,
		TAKES_PER_PLAYER_OPTIONS,
		VOTING_TIME_OPTIONS,
		GUESSING_TIME_OPTIONS,
	} from '../logic/constants.js';

	const { roomCode, players, settings, isHost, myPlayerId, activePlayers, canStartGame } =
		$derived(hotTakesStore);

	function toggleReady() {
		const myPlayer = players.find((p) => p.id === myPlayerId);
		if (myPlayer) {
			hotTakesStore.updateMyInfo({ isReady: !myPlayer.isReady });
		}
	}

	function toggleSpectator() {
		const myPlayer = players.find((p) => p.id === myPlayerId);
		if (myPlayer) {
			hotTakesStore.updateMyInfo({ isSpectator: !myPlayer.isSpectator });
		}
	}

	function updateTakesPerPlayer(value: number) {
		hotTakesStore.updateSettings({ takesPerPlayer: value as 1 | 2 | 3 });
	}

	function updateVotingTime(value: number) {
		hotTakesStore.updateSettings({ votingTimeSeconds: value as 10 | 15 | 20 | 30 });
	}

	function updateGuessingTime(value: number) {
		hotTakesStore.updateSettings({ guessingTimeSeconds: value as 15 | 20 | 30 | 45 });
	}

	const needMorePlayers = $derived(activePlayers.length < MIN_PLAYERS);
	const waitingForReady = $derived(activePlayers.some((p) => !p.isReady));
</script>

<div class="lobby">
	<header>
		<h1>🔥 Hot Takes</h1>
		<div class="room-code">
			<span class="code-label">Room code</span>
			<span class="code-value">{roomCode}</span>
		</div>
	</header>

	<div class="content">
		<section class="players-section">
			<h2>Players ({activePlayers.length}/{MIN_PLAYERS}+)</h2>
			<div class="players-list">
				{#each players as player (player.id)}
					<Card padding="md">
						<div class="player-card" class:disconnected={!player.isConnected}>
							<span class="player-emoji">{player.emoji}</span>
							<div class="player-info">
								<span class="player-name">
									{player.name}
									{#if player.id === myPlayerId}
										<span class="you-badge">(you)</span>
									{/if}
									{#if isHost && player.id === myPlayerId}
										<span class="host-badge">Host</span>
									{/if}
								</span>
								{#if player.isSpectator}
									<span class="status spectator">Spectating</span>
								{:else if player.isReady}
									<span class="status ready">Ready</span>
								{:else}
									<span class="status not-ready">Not ready</span>
								{/if}
							</div>
							{#if !player.isConnected}
								<span class="disconnected-badge">Disconnected</span>
							{/if}
						</div>
					</Card>
				{/each}
			</div>

			{#if !isHost}
				<div class="player-actions">
					<Button
						onclick={toggleReady}
						variant={players.find((p) => p.id === myPlayerId)?.isReady ? 'secondary' : 'primary'}
					>
						{players.find((p) => p.id === myPlayerId)?.isReady ? 'Not ready' : 'Ready'}
					</Button>
					<Button onclick={toggleSpectator} variant="ghost" size="sm">
						{players.find((p) => p.id === myPlayerId)?.isSpectator
							? 'Join game'
							: 'Watch as spectator'}
					</Button>
				</div>
			{/if}
		</section>

		{#if isHost}
			<section class="settings-section">
				<h2>Game settings</h2>

				<div class="setting">
					<span class="setting-label">Takes per player</span>
					<div class="option-buttons">
						{#each TAKES_PER_PLAYER_OPTIONS as option}
							<button
								class="option-btn"
								class:selected={settings.takesPerPlayer === option}
								onclick={() => updateTakesPerPlayer(option)}
							>
								{option}
							</button>
						{/each}
					</div>
				</div>

				<div class="setting">
					<span class="setting-label">Voting time (seconds)</span>
					<div class="option-buttons">
						{#each VOTING_TIME_OPTIONS as option}
							<button
								class="option-btn"
								class:selected={settings.votingTimeSeconds === option}
								onclick={() => updateVotingTime(option)}
							>
								{option}s
							</button>
						{/each}
					</div>
				</div>

				<div class="setting">
					<span class="setting-label">Guessing time (seconds)</span>
					<div class="option-buttons">
						{#each GUESSING_TIME_OPTIONS as option}
							<button
								class="option-btn"
								class:selected={settings.guessingTimeSeconds === option}
								onclick={() => updateGuessingTime(option)}
							>
								{option}s
							</button>
						{/each}
					</div>
				</div>
			</section>
		{:else}
			<section class="settings-section">
				<h2>Game settings</h2>
				<div class="settings-display">
					<div class="setting-item">
						<span class="setting-label">Takes per player:</span>
						<span class="setting-value">{settings.takesPerPlayer}</span>
					</div>
					<div class="setting-item">
						<span class="setting-label">Voting time:</span>
						<span class="setting-value">{settings.votingTimeSeconds}s</span>
					</div>
					<div class="setting-item">
						<span class="setting-label">Guessing time:</span>
						<span class="setting-value">{settings.guessingTimeSeconds}s</span>
					</div>
				</div>
			</section>
		{/if}
	</div>

	<footer>
		{#if isHost}
			{#if needMorePlayers}
				<p class="waiting-message">Need at least {MIN_PLAYERS} players to start</p>
			{:else if waitingForReady}
				<p class="waiting-message">Waiting for all players to be ready...</p>
			{/if}
			<Button
				onclick={() => hotTakesStore.startGame()}
				disabled={!canStartGame}
				variant="primary"
				size="lg"
			>
				Start game
			</Button>
		{:else}
			<p class="waiting-message">Waiting for host to start the game...</p>
		{/if}
		<Button onclick={() => hotTakesStore.leaveGame()} variant="ghost" size="sm">Leave game</Button>
	</footer>
</div>

<style>
	.lobby {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		padding: var(--space-xl);
		gap: var(--space-xl);
	}

	header {
		text-align: center;
	}

	h1 {
		font-size: var(--font-size-2xl);
		color: var(--color-text);
		margin-bottom: var(--space-md);
	}

	.room-code {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
	}

	.code-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.code-value {
		font-size: var(--font-size-3xl);
		font-weight: 700;
		font-family: monospace;
		letter-spacing: 0.2em;
		color: var(--color-primary);
	}

	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		max-width: 500px;
		margin: 0 auto;
		width: 100%;
	}

	section h2 {
		font-size: var(--font-size-lg);
		color: var(--color-text);
		margin-bottom: var(--space-md);
	}

	.players-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.player-card {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.player-card.disconnected {
		opacity: 0.5;
	}

	.player-emoji {
		font-size: 2rem;
	}

	.player-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.player-name {
		font-weight: 500;
		color: var(--color-text);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.you-badge {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.host-badge {
		font-size: var(--font-size-xs);
		background: var(--color-primary);
		color: white;
		padding: 2px 6px;
		border-radius: var(--radius-sm);
	}

	.status {
		font-size: var(--font-size-sm);
	}

	.status.ready {
		color: var(--color-success);
	}

	.status.not-ready {
		color: var(--color-text-muted);
	}

	.status.spectator {
		color: var(--color-primary);
	}

	.disconnected-badge {
		font-size: var(--font-size-xs);
		color: var(--color-error);
	}

	.player-actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		margin-top: var(--space-md);
	}

	.settings-section {
		background: var(--color-surface);
		padding: var(--space-lg);
		border-radius: var(--radius-lg);
	}

	.setting {
		margin-bottom: var(--space-lg);
	}

	.setting:last-child {
		margin-bottom: 0;
	}

	.setting .setting-label {
		display: block;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--space-sm);
	}

	.option-buttons {
		display: flex;
		gap: var(--space-sm);
	}

	.option-btn {
		flex: 1;
		padding: var(--space-sm) var(--space-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.option-btn:hover {
		border-color: var(--color-primary);
	}

	.option-btn.selected {
		border-color: var(--color-primary);
		background: var(--color-primary);
		color: white;
	}

	.settings-display {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.setting-item {
		display: flex;
		justify-content: space-between;
	}

	.setting-label {
		color: var(--color-text-muted);
	}

	.setting-value {
		font-weight: 500;
		color: var(--color-text);
	}

	footer {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
	}

	.waiting-message {
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}
</style>
