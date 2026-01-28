<script lang="ts">
	interface Props {
		onVote: (_vote: 'agree' | 'disagree') => void;
		disabled?: boolean;
		hasVoted?: boolean;
		myVote?: 'agree' | 'disagree' | null;
	}

	let { onVote, disabled = false, hasVoted = false, myVote = null }: Props = $props();
</script>

<div class="vote-buttons">
	<button
		class="vote-btn agree"
		class:selected={myVote === 'agree'}
		class:faded={hasVoted && myVote !== 'agree'}
		onclick={() => onVote('agree')}
		disabled={disabled || hasVoted}
	>
		<span class="vote-icon">👍</span>
		<span class="vote-label">Agree</span>
	</button>

	<button
		class="vote-btn disagree"
		class:selected={myVote === 'disagree'}
		class:faded={hasVoted && myVote !== 'disagree'}
		onclick={() => onVote('disagree')}
		disabled={disabled || hasVoted}
	>
		<span class="vote-icon">👎</span>
		<span class="vote-label">Disagree</span>
	</button>
</div>

<style>
	.vote-buttons {
		display: flex;
		gap: var(--space-xl);
		justify-content: center;
	}

	.vote-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-lg) var(--space-xl);
		border: 3px solid transparent;
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		cursor: pointer;
		transition: all var(--transition-fast);
		min-width: 120px;
	}

	.vote-btn:not(:disabled):hover {
		transform: scale(1.05);
	}

	.vote-btn:not(:disabled):active {
		transform: scale(0.98);
	}

	.vote-btn:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.vote-btn.agree {
		border-color: var(--color-success);
	}

	.vote-btn.agree:not(:disabled):hover {
		background: color-mix(in srgb, var(--color-success) 15%, var(--color-surface));
	}

	.vote-btn.disagree {
		border-color: var(--color-error);
	}

	.vote-btn.disagree:not(:disabled):hover {
		background: color-mix(in srgb, var(--color-error) 15%, var(--color-surface));
	}

	.vote-btn.selected {
		transform: scale(1.1);
	}

	.vote-btn.selected.agree {
		background: color-mix(in srgb, var(--color-success) 25%, var(--color-surface));
	}

	.vote-btn.selected.disagree {
		background: color-mix(in srgb, var(--color-error) 25%, var(--color-surface));
	}

	.vote-btn.faded {
		opacity: 0.4;
	}

	.vote-icon {
		font-size: 3rem;
	}

	.vote-label {
		font-size: var(--font-size-lg);
		font-weight: 600;
		color: var(--color-text);
	}
</style>
