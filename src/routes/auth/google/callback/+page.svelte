<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// This callback page is no longer needed with Google Identity Services,
	// which uses a popup flow instead of redirects.
	// Redirect users back to the home page.
	onMount(() => {
		goto('/');
	});
</script>

<svelte:head>
	<title>Redirecting... | Photo Roulette</title>
</svelte:head>

<div class="callback-container">
	<div class="status">
		<div class="spinner"></div>
		<h2>Redirecting...</h2>
	</div>
</div>

<style>
	.callback-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		padding: 1rem;
		background-color: #fdf6ee;
	}

	.status {
		text-align: center;
		padding: 2rem;
		background: white;
		border-radius: 16px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		max-width: 400px;
	}

	h2 {
		color: #2d2926;
		margin: 1rem 0 0.5rem;
		font-size: 1.5rem;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid #fdf6ee;
		border-top-color: #c85a35;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
