<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Spinner } from '$lib/common/components';
	import type { Player, PlayerId, Round } from '../logic/types.js';
	import { BLUR_REVEAL_DURATION_MS } from '../logic/constants.js';

	interface Props {
		round: Round;
		photoUrl: string | null;
		players: Player[];
		myGuess: PlayerId | null;
		guessCount: number;
		timerStartTime: number;
		timerEndTime: number;
		totalRounds: number;
		onGuess: (_playerId: PlayerId) => void;
	}

	let {
		round,
		photoUrl,
		players,
		myGuess,
		guessCount,
		timerStartTime,
		timerEndTime,
		totalRounds,
		onGuess,
	}: Props = $props();

	let imageLoaded = $state(false);
	let timeRemaining = $state(0);
	let blurAmount = $state(20);
	let animationFrame: number;

	const timerDuration = $derived(timerEndTime - timerStartTime);
	const progress = $derived(Math.max(0, timeRemaining / timerDuration));
	const hasGuessed = $derived(myGuess !== null);
	// Only non-spectators can be guessed (spectators have no photos)
	const guessablePlayers = $derived(players.filter((p) => !p.isSpectator));

	// Animate timer and blur
	function updateTimer() {
		const now = Date.now();
		const elapsed = now - timerStartTime;
		timeRemaining = Math.max(0, timerEndTime - now);

		// Calculate blur (starts at 20px, goes to 0 over BLUR_REVEAL_DURATION_MS)
		const blurProgress = Math.min(1, elapsed / BLUR_REVEAL_DURATION_MS);
		blurAmount = 20 * (1 - blurProgress);

		if (timeRemaining > 0) {
			animationFrame = requestAnimationFrame(updateTimer);
		}
	}

	onMount(() => {
		updateTimer();
	});

	onDestroy(() => {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}
	});

	function handleImageLoad() {
		imageLoaded = true;
	}

	function formatTime(ms: number): string {
		const seconds = Math.ceil(ms / 1000);
		return seconds.toString();
	}

	// Calculate SVG circle parameters for progress ring
	const radius = 120;
	const circumference = 2 * Math.PI * radius;
	const strokeDashoffset = $derived(circumference * (1 - progress));
</script>

<div class="game">
	<header class="header">
		<div class="round-info">
			Round {round.roundNumber} of {totalRounds}
		</div>
		<div class="timer">
			<span class="timer-value">{formatTime(timeRemaining)}</span>
		</div>
	</header>

	<div class="photo-container">
		<svg class="progress-ring" viewBox="0 0 260 260">
			<circle class="progress-track" cx="130" cy="130" r={radius} />
			<circle
				class="progress-fill"
				cx="130"
				cy="130"
				r={radius}
				stroke-dasharray={circumference}
				stroke-dashoffset={strokeDashoffset}
			/>
		</svg>

		<div class="photo-frame">
			{#if photoUrl}
				<img
					src={photoUrl}
					alt="Guess who this belongs to"
					class="photo"
					class:loaded={imageLoaded}
					style="filter: blur({blurAmount}px)"
					onload={handleImageLoad}
				/>
			{:else}
				<div class="photo-loading">
					<Spinner size="lg" />
				</div>
			{/if}
		</div>
	</div>

	<div class="guess-section">
		<h2>Whose photo is this?</h2>

		<div class="guess-count">
			{guessCount}/{players.length} have guessed
		</div>

		<div class="player-buttons">
			{#each guessablePlayers as player (player.id)}
				<button
					class="guess-button"
					class:selected={myGuess === player.id}
					onclick={() => onGuess(player.id)}
				>
					<span class="player-emoji">{player.emoji}</span>
					<span class="player-name">{player.name}</span>
					{#if myGuess === player.id}
						<span class="checkmark">✓</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if hasGuessed}
			<p class="guess-hint">You can change your guess until time runs out</p>
		{/if}
	</div>
</div>

<style>
	.game {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		padding: var(--space-lg);
		gap: var(--space-lg);
		max-width: 800px;
		margin: 0 auto;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.round-info {
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.timer {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.timer-value {
		font-size: var(--font-size-xl);
		font-weight: 600;
		color: var(--color-primary);
		min-width: 2ch;
		text-align: center;
	}

	.photo-container {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
		flex: 1;
		min-height: 300px;
	}

	.progress-ring {
		position: absolute;
		width: 100%;
		max-width: 260px;
		height: auto;
		transform: rotate(-90deg);
	}

	.progress-track {
		fill: none;
		stroke: var(--color-background);
		stroke-width: 8;
	}

	.progress-fill {
		fill: none;
		stroke: var(--color-primary);
		stroke-width: 8;
		stroke-linecap: round;
		transition: stroke-dashoffset 0.1s linear;
	}

	.photo-frame {
		position: relative;
		width: 90%;
		max-width: 500px;
		aspect-ratio: 4/3;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-lg);
	}

	.photo-loading {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface);
	}

	.photo-frame .photo {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: var(--color-background);
		opacity: 0;
		transition:
			opacity 0.3s ease,
			filter 0.1s linear;
		animation: kenBurns 15s ease-in-out infinite alternate;
	}

	.photo-frame .photo.loaded {
		opacity: 1;
	}

	@keyframes kenBurns {
		0% {
			transform: scale(1);
		}
		100% {
			transform: scale(1.05);
		}
	}

	.guess-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
	}

	.guess-section h2 {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--color-text);
	}

	.guess-count {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.player-buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-sm);
		width: 100%;
	}

	.guess-button {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		font-family: inherit;
		font-size: var(--font-size-base);
		cursor: pointer;
		transition:
			border-color var(--transition-fast),
			background-color var(--transition-fast),
			transform var(--transition-fast);
		min-width: 120px;
		min-height: 48px;
	}

	.guess-button:hover {
		background: var(--color-background);
	}

	.guess-button:active {
		transform: scale(0.98);
	}

	.guess-button.selected {
		border-color: var(--color-primary);
		background: rgba(200, 90, 53, 0.1);
	}

	.player-emoji {
		font-size: 1.5rem;
	}

	.player-name {
		font-weight: 500;
	}

	.checkmark {
		margin-left: auto;
		color: var(--color-primary);
		font-weight: bold;
	}

	.guess-hint {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin: 0;
	}

	@media (max-width: 480px) {
		.player-buttons {
			flex-direction: column;
		}

		.guess-button {
			width: 100%;
		}
	}
</style>
