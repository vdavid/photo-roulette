<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
	import {
		parseCallbackParams,
		validateState,
		exchangeCodeForToken,
		getPhotosConfig,
	} from '$lib/photos';

	let status = $state<'processing' | 'success' | 'error'>('processing');
	let errorMessage = $state<string>('');

	onMount(async () => {
		try {
			const params = parseCallbackParams(window.location.href);

			// Check for OAuth error
			if ('error' in params) {
				throw new Error(params.errorDescription || params.error);
			}

			// Validate state (CSRF protection)
			if (!validateState(params.state)) {
				throw new Error('Invalid state parameter. Please try again.');
			}

			// Get config and exchange code for token
			const config = getPhotosConfig(PUBLIC_GOOGLE_CLIENT_ID, window.location.origin);
			await exchangeCodeForToken(params.code, config);

			status = 'success';

			// Redirect back to the lobby after a short delay
			setTimeout(() => {
				// Go back to wherever the user came from, or home
				const returnTo = sessionStorage.getItem('photo-roulette-auth-return') || '/';
				sessionStorage.removeItem('photo-roulette-auth-return');
				goto(returnTo);
			}, 1500);
		} catch (error) {
			status = 'error';
			errorMessage = error instanceof Error ? error.message : 'Authentication failed';
		}
	});
</script>

<svelte:head>
	<title>Signing in... | Photo Roulette</title>
</svelte:head>

<div class="callback-container">
	{#if status === 'processing'}
		<div class="status">
			<div class="spinner"></div>
			<h2>Signing in...</h2>
			<p>Completing authentication with Google</p>
		</div>
	{:else if status === 'success'}
		<div class="status success">
			<div class="checkmark">✓</div>
			<h2>Success!</h2>
			<p>Redirecting you back to the game...</p>
		</div>
	{:else if status === 'error'}
		<div class="status error">
			<div class="error-icon">✕</div>
			<h2>Authentication failed</h2>
			<p>{errorMessage}</p>
			<a href="/" class="button">Return home</a>
		</div>
	{/if}
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

	p {
		color: #7a6f69;
		margin: 0;
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

	.checkmark {
		width: 48px;
		height: 48px;
		background: #5b8c5a;
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		font-weight: bold;
		margin: 0 auto;
	}

	.error-icon {
		width: 48px;
		height: 48px;
		background: #b54a4a;
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		font-weight: bold;
		margin: 0 auto;
	}

	.success h2 {
		color: #5b8c5a;
	}

	.error h2 {
		color: #b54a4a;
	}

	.button {
		display: inline-block;
		margin-top: 1.5rem;
		padding: 0.75rem 1.5rem;
		background: #c85a35;
		color: white;
		text-decoration: none;
		border-radius: 8px;
		font-weight: 500;
		transition: background 0.2s;
	}

	.button:hover {
		background: #b04d2d;
	}
</style>
