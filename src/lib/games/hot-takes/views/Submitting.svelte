<script lang="ts">
	import { Button, Card } from '$lib/common/components';
	import { hotTakesStore } from '../store.svelte.js';
	import { MAX_TAKE_LENGTH, MIN_TAKE_LENGTH } from '../logic/constants.js';

	const { settings, mySubmittedTakes, hasSubmittedAllTakes, activePlayers, myPlayerId } =
		$derived(hotTakesStore);

	let currentTakeText = $state('');
	let error = $state<string | null>(null);

	const takeNumber = $derived(mySubmittedTakes.length + 1);
	const charsRemaining = $derived(MAX_TAKE_LENGTH - currentTakeText.length);
	const isTooShort = $derived(currentTakeText.trim().length < MIN_TAKE_LENGTH);
	const isTooLong = $derived(currentTakeText.length > MAX_TAKE_LENGTH);

	function handleSubmit() {
		const text = currentTakeText.trim();

		if (text.length < MIN_TAKE_LENGTH) {
			error = `Take must be at least ${MIN_TAKE_LENGTH} characters`;
			return;
		}

		if (text.length > MAX_TAKE_LENGTH) {
			error = `Take must be at most ${MAX_TAKE_LENGTH} characters`;
			return;
		}

		error = null;
		hotTakesStore.submitTake(text);
		currentTakeText = '';
	}

	// Calculate who has submitted all their takes
	const submissionStatus = $derived(() => {
		return activePlayers.map((player) => ({
			...player,
			hasSubmitted: player.takeIds.length >= settings.takesPerPlayer,
			isMe: player.id === myPlayerId,
		}));
	});
</script>

<div class="submitting">
	<header>
		<h1>Submit your hot takes</h1>
		<p class="subtitle">
			Take {takeNumber} of {settings.takesPerPlayer}
		</p>
	</header>

	{#if hasSubmittedAllTakes}
		<Card padding="lg">
			<div class="waiting-state">
				<span class="check-icon">✓</span>
				<h2>All takes submitted!</h2>
				<p>Waiting for other players...</p>

				<div class="submission-progress">
					{#each submissionStatus() as player}
						<div class="player-status" class:submitted={player.hasSubmitted}>
							<span class="player-emoji">{player.emoji}</span>
							<span class="player-name">{player.name}</span>
							{#if player.hasSubmitted}
								<span class="status-icon">✓</span>
							{:else}
								<span class="status-icon pending">...</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</Card>
	{:else}
		<Card padding="lg">
			<div class="submit-form">
				<div class="input-section">
					<label for="take-input">Your hot take</label>
					<textarea
						id="take-input"
						bind:value={currentTakeText}
						placeholder="Share a controversial opinion..."
						maxlength={MAX_TAKE_LENGTH + 50}
						rows="4"
					></textarea>
					<div class="char-count" class:warning={charsRemaining < 50} class:error={isTooLong}>
						{charsRemaining} characters remaining
					</div>
				</div>

				{#if error}
					<p class="error">{error}</p>
				{/if}

				<Button
					onclick={handleSubmit}
					disabled={isTooShort || isTooLong}
					variant="primary"
					size="lg"
				>
					Submit take {takeNumber}/{settings.takesPerPlayer}
				</Button>

				<div class="tips">
					<h3>Tips for good hot takes:</h3>
					<ul>
						<li>Be controversial but not offensive</li>
						<li>Make it debatable (not obviously true/false)</li>
						<li>The best takes split the vote 50/50</li>
					</ul>
				</div>
			</div>
		</Card>

		{#if mySubmittedTakes.length > 0}
			<div class="submitted-takes">
				<h3>Your submitted takes:</h3>
				{#each mySubmittedTakes as take, i}
					<div class="submitted-take">
						<span class="take-number">{i + 1}.</span>
						<span class="take-text">"{take.text}"</span>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.submitting {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-xl);
		gap: var(--space-xl);
	}

	header {
		text-align: center;
	}

	h1 {
		font-size: var(--font-size-2xl);
		color: var(--color-text);
		margin-bottom: var(--space-sm);
	}

	.subtitle {
		color: var(--color-text-muted);
		font-size: var(--font-size-lg);
	}

	.waiting-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
		text-align: center;
	}

	.check-icon {
		font-size: 3rem;
		color: var(--color-success);
	}

	.waiting-state h2 {
		color: var(--color-text);
		margin: 0;
	}

	.waiting-state p {
		color: var(--color-text-muted);
	}

	.submission-progress {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
		max-width: 250px;
	}

	.player-status {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm);
		background: var(--color-background);
		border-radius: var(--radius-md);
	}

	.player-status.submitted {
		background: color-mix(in srgb, var(--color-success) 10%, var(--color-background));
	}

	.player-emoji {
		font-size: 1.5rem;
	}

	.player-name {
		flex: 1;
		color: var(--color-text);
		font-size: var(--font-size-sm);
	}

	.status-icon {
		color: var(--color-success);
		font-weight: bold;
	}

	.status-icon.pending {
		color: var(--color-text-muted);
	}

	.submit-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		width: 100%;
		max-width: 400px;
	}

	.input-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.input-section label {
		font-weight: 500;
		color: var(--color-text);
	}

	textarea {
		width: 100%;
		padding: var(--space-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font-family: inherit;
		font-size: var(--font-size-base);
		resize: vertical;
		min-height: 120px;
	}

	textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	textarea::placeholder {
		color: var(--color-text-muted);
	}

	.char-count {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		text-align: right;
	}

	.char-count.warning {
		color: var(--color-warning);
	}

	.char-count.error {
		color: var(--color-error);
	}

	.error {
		color: var(--color-error);
		font-size: var(--font-size-sm);
		text-align: center;
	}

	.tips {
		padding: var(--space-md);
		background: var(--color-background);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
	}

	.tips h3 {
		color: var(--color-text);
		margin-bottom: var(--space-sm);
	}

	.tips ul {
		color: var(--color-text-muted);
		padding-left: var(--space-lg);
		margin: 0;
	}

	.tips li {
		margin-bottom: var(--space-xs);
	}

	.submitted-takes {
		width: 100%;
		max-width: 400px;
	}

	.submitted-takes h3 {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--space-sm);
	}

	.submitted-take {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-sm);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-sm);
	}

	.take-number {
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.take-text {
		color: var(--color-text);
		font-style: italic;
		font-size: var(--font-size-sm);
	}
</style>
