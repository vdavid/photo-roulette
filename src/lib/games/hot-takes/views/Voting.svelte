<script lang="ts">
	import { TakeCard, VoteButtons, Timer } from '../components/index.js';
	import { hotTakesStore } from '../store.svelte.js';

	const { currentTake, takeProgress, timerEndTime, currentRound, myPlayerId } =
		$derived(hotTakesStore);

	// Check if current player has already voted
	const hasVoted = $derived(() => {
		if (!currentRound || !currentTake) return false;
		return currentRound.votes.some((v) => v.playerId === myPlayerId && v.takeId === currentTake.id);
	});

	const myVote = $derived(() => {
		if (!currentRound || !currentTake || !myPlayerId) return null;
		const vote = currentRound.votes.find(
			(v) => v.playerId === myPlayerId && v.takeId === currentTake.id
		);
		return vote?.vote ?? null;
	});

	function handleVote(vote: 'agree' | 'disagree') {
		hotTakesStore.submitVote(vote);
	}
</script>

<div class="voting">
	<header>
		<div class="progress">
			<span class="progress-label">Hot take</span>
			<span class="progress-value">{takeProgress.current} / {takeProgress.total}</span>
		</div>
		<Timer endTime={timerEndTime} />
	</header>

	{#if currentTake}
		<div class="take-display">
			<TakeCard text={currentTake.text} />
		</div>

		<div class="vote-section">
			{#if hasVoted()}
				<p class="voted-message">Vote submitted! Waiting for others...</p>
			{:else}
				<p class="prompt">Do you agree with this take?</p>
			{/if}

			<VoteButtons
				onVote={handleVote}
				disabled={hasVoted()}
				hasVoted={hasVoted()}
				myVote={myVote()}
			/>
		</div>
	{:else}
		<div class="loading">
			<p>Loading take...</p>
		</div>
	{/if}
</div>

<style>
	.voting {
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
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
	}

	.vote-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
	}

	.prompt {
		font-size: var(--font-size-lg);
		color: var(--color-text);
		font-weight: 500;
	}

	.voted-message {
		font-size: var(--font-size-lg);
		color: var(--color-success);
		font-weight: 500;
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
