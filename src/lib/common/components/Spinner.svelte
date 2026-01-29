<script lang="ts">
	type SpinnerSize = 'sm' | 'md' | 'lg';

	interface Props {
		size?: SpinnerSize;
	}

	let { size = 'md' }: Props = $props();
</script>

<div class="spinner {size}" role="status" aria-label="Loading">
	<span class="sr-only">Loading...</span>
</div>

<style>
	.spinner {
		border-style: solid;
		border-color: var(--color-background);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	/*noinspection CssUnusedSymbol*/
	.sm {
		width: 20px;
		height: 20px;
		border-width: 2px;
	}

	/*noinspection CssUnusedSymbol*/
	.md {
		width: 40px;
		height: 40px;
		border-width: 3px;
	}

	/*noinspection CssUnusedSymbol*/
	.lg {
		width: 64px;
		height: 64px;
		border-width: 4px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
