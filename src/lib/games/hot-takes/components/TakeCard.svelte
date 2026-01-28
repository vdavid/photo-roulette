<script lang="ts">
	import { Card } from '$lib/common/components';

	interface Props {
		text: string;
		authorName?: string;
		authorEmoji?: string;
		isRevealed?: boolean;
		agreePercent?: number;
	}

	let {
		text,
		authorName = '',
		authorEmoji = '',
		isRevealed = false,
		agreePercent,
	}: Props = $props();
</script>

<div class="take-card" class:revealed={isRevealed}>
	<Card padding="lg">
		<div class="take-content">
			<p class="take-text">"{text}"</p>

			{#if isRevealed && authorName}
				<div class="author-reveal">
					<span class="author-emoji">{authorEmoji}</span>
					<span class="author-name">{authorName}</span>
				</div>
			{/if}

			{#if agreePercent !== undefined}
				<div class="vote-result">
					<div class="vote-bar">
						<div class="agree-bar" style="width: {agreePercent}%"></div>
						<div class="disagree-bar" style="width: {100 - agreePercent}%"></div>
					</div>
					<div class="vote-labels">
						<span class="agree-label">{agreePercent}% agree</span>
						<span class="disagree-label">{100 - agreePercent}% disagree</span>
					</div>
				</div>
			{/if}
		</div>
	</Card>
</div>

<style>
	.take-card {
		width: 100%;
		max-width: 500px;
	}

	.take-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.take-text {
		font-size: var(--font-size-xl);
		font-style: italic;
		line-height: 1.6;
		color: var(--color-text);
		margin: 0;
		text-align: center;
	}

	.author-reveal {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding-top: var(--space-md);
		border-top: 1px solid var(--color-border);
		animation: fadeIn 0.5s ease-out;
	}

	.author-emoji {
		font-size: 2rem;
	}

	.author-name {
		font-size: var(--font-size-lg);
		font-weight: 600;
		color: var(--color-text);
	}

	.vote-result {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.vote-bar {
		display: flex;
		height: 12px;
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.agree-bar {
		background: var(--color-success);
		transition: width 0.5s ease-out;
	}

	.disagree-bar {
		background: var(--color-error);
		transition: width 0.5s ease-out;
	}

	.vote-labels {
		display: flex;
		justify-content: space-between;
		font-size: var(--font-size-sm);
	}

	.agree-label {
		color: var(--color-success);
	}

	.disagree-label {
		color: var(--color-error);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
