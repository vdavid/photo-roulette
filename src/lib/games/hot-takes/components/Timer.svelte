<script lang="ts">
	interface Props {
		endTime: number | null;
		onExpire?: () => void;
	}

	let { endTime, onExpire }: Props = $props();

	let timeRemaining = $state(0);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	function updateTimer() {
		if (!endTime) {
			timeRemaining = 0;
			return;
		}

		const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
		timeRemaining = remaining;

		if (remaining === 0 && onExpire) {
			onExpire();
		}
	}

	$effect(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}

		if (endTime) {
			updateTimer();
			intervalId = setInterval(updateTimer, 100);
		}

		return () => {
			if (intervalId) {
				clearInterval(intervalId);
			}
		};
	});

	const isLow = $derived(timeRemaining <= 5);
	const isCritical = $derived(timeRemaining <= 3);
</script>

<div class="timer" class:low={isLow} class:critical={isCritical}>
	<span class="timer-value">{timeRemaining}</span>
	<span class="timer-label">seconds</span>
</div>

<style>
	.timer {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-md) var(--space-lg);
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		border: 2px solid var(--color-border);
		transition: all var(--transition-fast);
	}

	.timer.low {
		border-color: var(--color-warning);
		background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
	}

	.timer.critical {
		border-color: var(--color-error);
		background: color-mix(in srgb, var(--color-error) 15%, var(--color-surface));
		animation: shake 0.5s ease-in-out infinite;
	}

	.timer-value {
		font-size: var(--font-size-3xl);
		font-weight: 700;
		color: var(--color-text);
		line-height: 1;
	}

	.timer.low .timer-value {
		color: var(--color-warning);
	}

	.timer.critical .timer-value {
		color: var(--color-error);
	}

	.timer-label {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		25% {
			transform: translateX(-2px);
		}
		75% {
			transform: translateX(2px);
		}
	}
</style>
