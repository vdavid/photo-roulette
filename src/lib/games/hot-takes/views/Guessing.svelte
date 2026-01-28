<script lang="ts">
	import { TakeCard, VoteResults, PlayerGuessButton, Timer } from '../components/index.js';
	import { hotTakesStore } from '../store.svelte.js';
	import type { PlayerId } from '$lib/common/networking/types.js';
	import { calculateAgreePercent } from '../logic/scoring.js';

	const {
		currentTake,
		takeProgress,
		timerEndTime,
		currentRound,
		myPlayerId,
		activePlayers,
		isMyTake,
	} = $derived(hotTakesStore);

	const agreePercent = $derived(() => {
		if (!currentRound) return 50;
		return calculateAgreePercent(currentRound.votes);
	});

	// Check if current player has already guessed
	const hasGuessed = $derived(() => {
		if (!currentRound || !currentTake) return false;
		return currentRound.guesses.some(
			(g) => g.playerId === myPlayerId && g.takeId === currentTake.id
		);
	});

	const myGuess = $derived(() => {
		if (!currentRound || !currentTake || !myPlayerId) return null;
		const guess = currentRound.guesses.find(
			(g) => g.playerId === myPlayerId && g.takeId === currentTake.id
		);
		return guess?.guessedAuthorId ?? null;
	});

	// Filter out yourself from guessing options (and the author can't guess their own)
	const guessablePlayers = $derived(activePlayers.filter((p) => p.id !== myPlayerId));

	function handleGuess(playerId: PlayerId) {
		hotTakesStore.submitGuess(playerId);
	}
</script>

<div class="guessing">
	<header>
		<div class="progress">
			<span class="progress-label">Hot take</span>
			<span class="progress-value">{takeProgress.current} / {takeProgress.total}</span>
		</div>
		<Timer endTime={timerEndTime} />
	</header>

	{#if currentTake}
		<div class="take-display">
			<TakeCard text={currentTake.text} agreePercent={agreePercent()} />
		</div>

		<VoteResults agreePercent={agreePercent()} showControversyBadge={false} />

		{#if isMyTake}
			<div class="own-take-message">
				<p>This is your take! Waiting for others to guess...</p>
			</div>
		{:else}
			<div class="guess-section">
				{#if hasGuessed()}
					<p class="guessed-message">Guess submitted! Waiting for others...</p>
				{:else}
					<p class="prompt">Who wrote this take?</p>
				{/if}

				<div class="player-grid">
					{#each guessablePlayers as player (player.id)}
						<PlayerGuessButton
							playerId={player.id}
							name={player.name}
							emoji={player.emoji}
							onGuess={handleGuess}
							disabled={hasGuessed()}
							isSelected={myGuess() === player.id}
						/>
					{/each}
				</div>
			</div>
		{/if}
	{:else}
		<div class="loading">
			<p>Loading take...</p>
		</div>
	{/if}
</div>

<style>
	.guessing {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-xl);
		gap: var(--space-xl);
	}

	header {
		width: 100%;
		max-width: 500px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.progress {
		display: flex;
		flex-direction: column;
	}

	.progress-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.progress-value {
		font-size: var(--font-size-2xl);
		font-weight: 700;
		color: var(--color-text);
	}

	.take-display {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
	}

	.own-take-message {
		text-align: center;
		padding: var(--space-xl);
	}

	.own-take-message p {
		font-size: var(--font-size-lg);
		color: var(--color-primary);
		font-weight: 500;
	}

	.guess-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
		width: 100%;
	}

	.prompt {
		font-size: var(--font-size-lg);
		color: var(--color-text);
		font-weight: 500;
	}

	.guessed-message {
		font-size: var(--font-size-lg);
		color: var(--color-success);
		font-weight: 500;
	}

	.player-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-md);
		max-width: 500px;
	}

	.loading {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.loading p {
		color: var(--color-text-muted);
	}
</style>
