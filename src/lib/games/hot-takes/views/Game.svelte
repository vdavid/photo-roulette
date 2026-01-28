<script lang="ts">
	import { hotTakesStore } from '../store.svelte.js';
	import Landing from './Landing.svelte';
	import Lobby from './Lobby.svelte';
	import Submitting from './Submitting.svelte';
	import Voting from './Voting.svelte';
	import Guessing from './Guessing.svelte';
	import Reveal from './Reveal.svelte';
	import Final from './Final.svelte';

	interface Props {
		onBackToMenu?: () => void;
	}

	let { onBackToMenu }: Props = $props();

	const { phase, connectionStatus } = $derived(hotTakesStore);

	// Determine which view to show based on connection and phase
	const showLanding = $derived(connectionStatus === 'disconnected' || connectionStatus === 'error');
</script>

<div class="game">
	{#if showLanding}
		<Landing {onBackToMenu} />
	{:else if connectionStatus === 'connecting' || connectionStatus === 'reconnecting'}
		<div class="connecting">
			<div class="spinner"></div>
			<p>{connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}</p>
		</div>
	{:else if phase === 'lobby'}
		<Lobby />
	{:else if phase === 'submitting'}
		<Submitting />
	{:else if phase === 'voting'}
		<Voting />
	{:else if phase === 'guessing'}
		<Guessing />
	{:else if phase === 'reveal'}
		<Reveal />
	{:else if phase === 'final'}
		<Final {onBackToMenu} />
	{:else}
		<div class="unknown">
			<p>Unknown game state</p>
		</div>
	{/if}
</div>

<style>
	.game {
		min-height: 100vh;
	}

	.connecting,
	.unknown {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-lg);
	}

	.connecting p,
	.unknown p {
		color: var(--color-text-muted);
		font-size: var(--font-size-lg);
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
