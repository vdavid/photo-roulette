<script lang="ts">
	import type { Snippet } from 'svelte';

	type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type ButtonSize = 'sm' | 'md' | 'lg';

	interface Props {
		variant?: ButtonVariant;
		size?: ButtonSize;
		disabled?: boolean;
		loading?: boolean;
		fullWidth?: boolean;
		type?: 'button' | 'submit' | 'reset';
		onclick?: (_event: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		fullWidth = false,
		type = 'button',
		onclick,
		children,
	}: Props = $props();

	const isDisabled = $derived(disabled || loading);
</script>

<button
	class="button {variant} {size}"
	class:full-width={fullWidth}
	class:loading
	{type}
	disabled={isDisabled}
	{onclick}
>
	{#if loading}
		<span class="spinner"></span>
	{/if}
	<span class="content" class:hidden={loading}>
		{@render children()}
	</span>
</button>

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		font-family: inherit;
		font-weight: 500;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition:
			background-color var(--transition-fast),
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
		position: relative;
		white-space: nowrap;
	}

	.button:active:not(:disabled) {
		transform: scale(0.98);
	}

	.button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Sizes */
	.sm {
		padding: var(--space-sm) var(--space-md);
		font-size: var(--font-size-sm);
		min-height: 36px;
	}

	.md {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--font-size-base);
		min-height: 44px;
	}

	.lg {
		padding: var(--space-md) var(--space-xl);
		font-size: var(--font-size-lg);
		min-height: 52px;
	}

	/* Variants */
	.primary {
		background-color: var(--color-primary);
		color: white;
	}

	.primary:hover:not(:disabled) {
		background-color: var(--color-primary-hover);
	}

	.secondary {
		background-color: var(--color-secondary);
		color: var(--color-text);
	}

	.secondary:hover:not(:disabled) {
		background-color: var(--color-secondary-hover);
	}

	.ghost {
		background-color: transparent;
		color: var(--color-text);
	}

	.ghost:hover:not(:disabled) {
		background-color: rgba(0, 0, 0, 0.05);
	}

	.danger {
		background-color: var(--color-error);
		color: white;
	}

	.danger:hover:not(:disabled) {
		background-color: var(--color-error-light);
	}

	/* Full width */
	.full-width {
		width: 100%;
	}

	/* Loading state */
	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		position: absolute;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.content.hidden {
		visibility: hidden;
	}
</style>
