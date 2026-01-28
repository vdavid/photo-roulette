<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		padding?: 'none' | 'sm' | 'md' | 'lg';
		children: Snippet;
	}

	let { padding = 'md', children }: Props = $props();
</script>

<div class="card padding-{padding}">
	{@render children()}
</div>

<style>
	.card {
		background-color: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
	}

	.padding-none {
		padding: 0;
	}

	.padding-sm {
		padding: var(--space-md);
	}

	.padding-md {
		padding: var(--space-lg);
	}

	.padding-lg {
		padding: var(--space-xl);
	}
</style>
