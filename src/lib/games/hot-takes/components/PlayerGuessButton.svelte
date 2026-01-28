<script lang="ts">
	import type { PlayerId } from '$lib/common/networking/types.js';

	interface Props {
		playerId: PlayerId;
		name: string;
		emoji: string;
		onGuess: (_playerId: PlayerId) => void;
		disabled?: boolean;
		isSelected?: boolean;
		isCorrect?: boolean;
		isRevealed?: boolean;
	}

	let {
		playerId,
		name,
		emoji,
		onGuess,
		disabled = false,
		isSelected = false,
		isCorrect = false,
		isRevealed = false,
	}: Props = $props();
</script>

<button
	class="guess-btn"
	class:selected={isSelected}
	class:correct={isRevealed && isCorrect}
	class:incorrect={isRevealed && isSelected && !isCorrect}
	onclick={() => onGuess(playerId)}
	{disabled}
>
	<span class="player-emoji">{emoji}</span>
	<span class="player-name">{name}</span>
	{#if isRevealed && isCorrect}
		<span class="result-icon correct-icon">✓</span>
	{:else if isRevealed && isSelected && !isCorrect}
		<span class="result-icon incorrect-icon">✗</span>
	{/if}
</button>

<style>
	.guess-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		cursor: pointer;
		transition: all var(--transition-fast);
		min-width: 100px;
		position: relative;
	}

	.guess-btn:not(:disabled):hover {
		border-color: var(--color-primary);
		transform: translateY(-2px);
	}

	.guess-btn:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.guess-btn.selected {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface));
	}

	.guess-btn.correct {
		border-color: var(--color-success);
		background: color-mix(in srgb, var(--color-success) 20%, var(--color-surface));
	}

	.guess-btn.incorrect {
		border-color: var(--color-error);
		background: color-mix(in srgb, var(--color-error) 15%, var(--color-surface));
	}

	.player-emoji {
		font-size: 2rem;
	}

	.player-name {
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 80px;
	}

	.result-icon {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		font-size: var(--font-size-sm);
		font-weight: 700;
		color: white;
	}

	.correct-icon {
		background: var(--color-success);
	}

	.incorrect-icon {
		background: var(--color-error);
	}
</style>
