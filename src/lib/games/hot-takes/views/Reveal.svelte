<script lang="ts">
	import { Card } from '$lib/common/components';
	import { TakeCard, VoteResults } from '../components/index.js';
	import { hotTakesStore } from '../store.svelte.js';
	import { CORRECT_GUESS_POINTS, CONTROVERSIAL_TAKE_POINTS } from '../logic/constants.js';

	const { takeResults, takeProgress, players, myPlayerId, playerScores } = $derived(hotTakesStore);

	// Get the most recent result
	const latestResult = $derived(takeResults[takeResults.length - 1] ?? null);

	// Get author info
	const author = $derived(() => {
		if (!latestResult) return null;
		return players.find((p) => p.id === latestResult.authorId);
	});

	// Get players who guessed correctly
	const correctGuessers = $derived(() => {
		if (!latestResult) return [];
		return latestResult.guesses
			.filter((g) => g.guessedAuthorId === latestResult.authorId)
			.map((g) => {
				const player = players.find((p) => p.id === g.playerId);
				return player ? { name: player.name, emoji: player.emoji } : null;
			})
			.filter(Boolean);
	});

	// Check if the take was controversial
	const isControversial = $derived(latestResult?.isControversial ?? false);

	// Get my score
	const myCurrentScore = $derived(() => {
		if (!myPlayerId) return null;
		return playerScores.get(myPlayerId) ?? null;
	});
</script>

<div class="reveal">
	<header>
		<div class="progress">
			<span class="progress-label">Hot take</span>
			<span class="progress-value">{takeProgress.current} / {takeProgress.total}</span>
		</div>
	</header>

	{#if latestResult}
		<div class="take-display">
			<TakeCard
				text={hotTakesStore.takes.find((t) => t.id === latestResult.takeId)?.text ?? ''}
				authorName={author()?.name ?? 'Unknown'}
				authorEmoji={author()?.emoji ?? '?'}
				isRevealed={true}
			/>
		</div>

		<VoteResults agreePercent={latestResult.agreePercent} />

		<div class="results-section">
			{#if isControversial}
				<Card padding="md">
					<div class="points-earned controversial">
						<span class="points-icon">🔥</span>
						<div class="points-info">
							<span class="points-label">Controversial take!</span>
							<span class="points-value">+{CONTROVERSIAL_TAKE_POINTS} pts for {author()?.name}</span
							>
						</div>
					</div>
				</Card>
			{/if}

			{#if correctGuessers().length > 0}
				<Card padding="md">
					<div class="correct-guessers">
						<span class="guessers-label">Guessed correctly:</span>
						<div class="guessers-list">
							{#each correctGuessers() as guesser}
								<div class="guesser">
									<span class="guesser-emoji">{guesser?.emoji}</span>
									<span class="guesser-name">{guesser?.name}</span>
									<span class="guesser-points">+{CORRECT_GUESS_POINTS}</span>
								</div>
							{/each}
						</div>
					</div>
				</Card>
			{:else}
				<Card padding="md">
					<p class="no-correct">No one guessed correctly!</p>
				</Card>
			{/if}
		</div>

		<div class="my-score">
			{#if myCurrentScore()}
				<span class="score-label">Your score:</span>
				<span class="score-value">{myCurrentScore()?.totalPoints ?? 0} pts</span>
			{/if}
		</div>

		<p class="advancing">Next take coming up...</p>
	{:else}
		<div class="loading">
			<p>Loading results...</p>
		</div>
	{/if}
</div>

<style>
	.reveal {
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
		justify-content: center;
	}

	.progress {
		display: flex;
		flex-direction: column;
		align-items: center;
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
		justify-content: center;
		width: 100%;
		animation: fadeIn 0.5s ease-out;
	}

	.results-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 400px;
	}

	.points-earned {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.points-earned.controversial {
		color: var(--color-text);
	}

	.points-icon {
		font-size: 2rem;
	}

	.points-info {
		display: flex;
		flex-direction: column;
	}

	.points-label {
		font-weight: 600;
		color: var(--color-text);
	}

	.points-value {
		font-size: var(--font-size-sm);
		color: var(--color-success);
	}

	.correct-guessers {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.guessers-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.guessers-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.guesser {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-xs) var(--space-sm);
		background: color-mix(in srgb, var(--color-success) 15%, var(--color-background));
		border-radius: var(--radius-md);
	}

	.guesser-emoji {
		font-size: 1.25rem;
	}

	.guesser-name {
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.guesser-points {
		font-size: var(--font-size-sm);
		color: var(--color-success);
		font-weight: 600;
	}

	.no-correct {
		color: var(--color-text-muted);
		text-align: center;
		margin: 0;
	}

	.my-score {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.score-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.score-value {
		font-size: var(--font-size-2xl);
		font-weight: 700;
		color: var(--color-primary);
	}

	.advancing {
		color: var(--color-text-muted);
		font-style: italic;
		animation: pulse 1.5s ease-in-out infinite;
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

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}
</style>
