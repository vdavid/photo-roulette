<script lang="ts">
	import { CONTROVERSIAL_MIN_PERCENT, CONTROVERSIAL_MAX_PERCENT } from '../logic/constants.js';

	interface Props {
		agreePercent: number;
		showControversyBadge?: boolean;
	}

	let { agreePercent, showControversyBadge = true }: Props = $props();

	const isControversial = $derived(
		agreePercent >= CONTROVERSIAL_MIN_PERCENT && agreePercent <= CONTROVERSIAL_MAX_PERCENT
	);
</script>

<div class="vote-results">
	<div class="result-header">
		<span class="result-title">Vote results</span>
		{#if showControversyBadge && isControversial}
			<span class="controversy-badge">Controversial!</span>
		{/if}
	</div>

	<div class="vote-bar-container">
		<div class="vote-bar">
			<div class="agree-bar" style="width: {agreePercent}%">
				{#if agreePercent >= 15}
					<span class="bar-label">👍 {agreePercent}%</span>
				{/if}
			</div>
			<div class="disagree-bar" style="width: {100 - agreePercent}%">
				{#if 100 - agreePercent >= 15}
					<span class="bar-label">👎 {100 - agreePercent}%</span>
				{/if}
			</div>
		</div>
	</div>

	<div class="vote-labels">
		<span class="agree-count">{agreePercent}% agree</span>
		<span class="disagree-count">{100 - agreePercent}% disagree</span>
	</div>
</div>

<style>
	.vote-results {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 400px;
	}

	.result-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.result-title {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.controversy-badge {
		background: linear-gradient(135deg, #ff6b6b, #feca57);
		color: white;
		font-size: var(--font-size-xs);
		font-weight: 700;
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-full);
		animation: pulse 1s ease-in-out infinite;
	}

	.vote-bar-container {
		position: relative;
	}

	.vote-bar {
		display: flex;
		height: 40px;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--color-surface);
	}

	.agree-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #2ecc71, #27ae60);
		transition: width 0.5s ease-out;
	}

	.disagree-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #e74c3c, #c0392b);
		transition: width 0.5s ease-out;
	}

	.bar-label {
		color: white;
		font-size: var(--font-size-sm);
		font-weight: 600;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	.vote-labels {
		display: flex;
		justify-content: space-between;
		font-size: var(--font-size-sm);
	}

	.agree-count {
		color: #27ae60;
		font-weight: 500;
	}

	.disagree-count {
		color: #c0392b;
		font-weight: 500;
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.05);
		}
	}
</style>
