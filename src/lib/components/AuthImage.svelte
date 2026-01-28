<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import { fetchAuthenticatedImage, revokeBlobUrl } from '$lib/photos/authenticated-fetch.js'

	interface Props {
		src: string;
		alt: string;
		class?: string;
		style?: string;
		onload?: () => void;
		onerror?: (_error: Error) => void;
	}

	let { src, alt, class: className = '', style = '', onload, onerror }: Props = $props();

	let blobUrl = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<Error | null>(null);

	// Track the current src to detect changes
	let currentSrc = $state(src);

	// Fetch the image when src changes
	$effect(() => {
		if (src !== currentSrc) {
			// Clean up old blob URL
			if (blobUrl) {
				revokeBlobUrl(blobUrl);
			}
			blobUrl = null;
			loading = true;
			error = null;
			currentSrc = src;
		}
	});

	onMount(async () => {
		await loadImage();
	});

	// Reload when src changes
	$effect(() => {
		if (src && !blobUrl && !error) {
			loadImage();
		}
	});

	async function loadImage() {
		if (!src) return;

		loading = true;
		error = null;

		try {
			blobUrl = await fetchAuthenticatedImage(src);
			loading = false;
		} catch (e) {
			error = e instanceof Error ? e : new Error('Failed to load image');
			loading = false;
			onerror?.(error);
		}
	}

	function handleLoad() {
		onload?.();
	}

	onDestroy(() => {
		// Note: We don't revoke here because the URL might be cached and reused
		// The cache handles cleanup when clearBlobUrlCache is called
	});
</script>

{#if loading}
	<div class="auth-image-loading {className}" {style}>
		<div class="spinner"></div>
	</div>
{:else if error}
	<div class="auth-image-error {className}" {style}>
		<span class="error-icon">⚠️</span>
		<span class="error-text">Failed to load</span>
	</div>
{:else if blobUrl}
	<img src={blobUrl} {alt} class={className} {style} onload={handleLoad} />
{/if}

<style>
	.auth-image-loading,
	.auth-image-error {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-background, #fdf6ee);
		min-height: 200px;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid var(--color-background, #fdf6ee);
		border-top-color: var(--color-primary, #c85a35);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.auth-image-error {
		flex-direction: column;
		gap: 0.5rem;
		color: var(--color-error, #b54a4a);
	}

	.error-icon {
		font-size: 2rem;
	}

	.error-text {
		font-size: 0.875rem;
	}

	img {
		display: block;
	}
</style>
