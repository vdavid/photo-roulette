<script lang="ts">
	import { browser } from '$app/environment';
	import { Button, Card, Input, EmojiPicker } from '$lib/components';
	import { ANIMAL_EMOJIS } from '$lib/game/constants.js';

	const STORAGE_KEY_NAME = 'photoRoulette.playerName';
	const STORAGE_KEY_EMOJI = 'photoRoulette.playerEmoji';

	interface Props {
		onHostGame: (_name: string, _emoji: string) => Promise<void>;
		onJoinGame: (_code: string, _name: string, _emoji: string) => Promise<void>;
	}

	let { onHostGame, onJoinGame }: Props = $props();

	// Load saved values from localStorage, or use defaults
	function getInitialName(): string {
		if (browser) {
			return localStorage.getItem(STORAGE_KEY_NAME) || '';
		}
		return '';
	}

	function getInitialEmoji(): string {
		if (browser) {
			const saved = localStorage.getItem(STORAGE_KEY_EMOJI);
			if (saved && ANIMAL_EMOJIS.includes(saved)) {
				return saved;
			}
		}
		return ANIMAL_EMOJIS[Math.floor(Math.random() * ANIMAL_EMOJIS.length)];
	}

	function saveToLocalStorage(playerName: string, playerEmoji: string) {
		if (browser) {
			localStorage.setItem(STORAGE_KEY_NAME, playerName);
			localStorage.setItem(STORAGE_KEY_EMOJI, playerEmoji);
		}
	}

	let mode = $state<'select' | 'host' | 'join'>('select');
	let name = $state(getInitialName());
	let emoji = $state(getInitialEmoji());
	let roomCode = $state('');
	let isLoading = $state(false);
	let error = $state('');

	async function handleHost() {
		if (!name.trim()) {
			error = 'Please enter your name';
			return;
		}

		isLoading = true;
		error = '';

		try {
			saveToLocalStorage(name.trim(), emoji);
			await onHostGame(name.trim(), emoji);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create game';
			isLoading = false;
		}
	}

	async function handleJoin() {
		if (!name.trim()) {
			error = 'Please enter your name';
			return;
		}

		if (!roomCode.trim()) {
			error = 'Please enter a room code';
			return;
		}

		isLoading = true;
		error = '';

		try {
			saveToLocalStorage(name.trim(), emoji);
			await onJoinGame(roomCode.trim().toUpperCase(), name.trim(), emoji);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to join game';
			isLoading = false;
		}
	}

	function handleBack() {
		mode = 'select';
		error = '';
	}
</script>

<div class="landing">
	<div class="logo">
		<svg class="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 135.5 135.5"
			><path
				fill="#b54a4a"
				d="M32 131c-7-2-12-9-12-16s2-9 5-9c2 1 2 1 2-1 2-17 20-31 38-29 5 1 4 1 5-1 1-5 4-9 6-13 2-1 2-1 0-4-8-19-12-47-7-51 2-2 3-1 10 19a1253 1253 0 0 0 6 16c0-16 7-38 11-38 3 0 3-1 2 27 0 25 0 25 2 25 16 3 20 19 7 25l-1 2a71 71 0 0 1-3 33h1c6 3 10 13 5 15H32z"
			/></svg
		>
		<h1>Photo Roulette</h1>
		<p class="tagline">Guess whose photo it is!</p>
	</div>

	<Card>
		{#if mode === 'select'}
			<div class="select-mode">
				<Button size="lg" fullWidth onclick={() => (mode = 'host')}>Host a game</Button>
				<Button size="lg" variant="secondary" fullWidth onclick={() => (mode = 'join')}>
					Join a game
				</Button>
			</div>
		{:else if mode === 'host'}
			<form
				class="form"
				onsubmit={(e) => {
					e.preventDefault();
					handleHost();
				}}
			>
				<h2>Host a game</h2>

				<div class="form-field">
					<label for="name">Your name</label>
					<Input
						id="name"
						bind:value={name}
						placeholder="Enter your name"
						maxlength={20}
						autofocus
					/>
				</div>

				<div class="form-field">
					<span class="field-label">Pick your emoji</span>
					<EmojiPicker selected={emoji} onselect={(e) => (emoji = e)} />
				</div>

				{#if error}
					<p class="error">{error}</p>
				{/if}

				<div class="form-actions">
					<Button variant="ghost" onclick={handleBack} disabled={isLoading}>Back</Button>
					<Button type="submit" loading={isLoading}>Create game</Button>
				</div>
			</form>
		{:else if mode === 'join'}
			<form
				class="form"
				onsubmit={(e) => {
					e.preventDefault();
					handleJoin();
				}}
			>
				<h2>Join a game</h2>

				<div class="form-field">
					<label for="room-code">Room code</label>
					<Input
						id="room-code"
						bind:value={roomCode}
						placeholder="e.g. X7K2"
						maxlength={4}
						autofocus
						oninput={(v) => (roomCode = v.toUpperCase())}
					/>
				</div>

				<div class="form-field">
					<label for="join-name">Your name</label>
					<Input id="join-name" bind:value={name} placeholder="Enter your name" maxlength={20} />
				</div>

				<div class="form-field">
					<span class="field-label">Pick your emoji</span>
					<EmojiPicker selected={emoji} onselect={(e) => (emoji = e)} />
				</div>

				{#if error}
					<p class="error">{error}</p>
				{/if}

				<div class="form-actions">
					<Button variant="ghost" onclick={handleBack} disabled={isLoading}>Back</Button>
					<Button type="submit" loading={isLoading}>Join game</Button>
				</div>
			</form>
		{/if}
	</Card>
</div>

<style>
	.landing {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-lg);
		gap: var(--space-xl);
	}

	.logo {
		text-align: center;
	}

	.logo-icon {
		width: 16rem;
		height: 16rem;
		display: block;
		margin: 0 auto var(--space-md);
	}

	.logo h1 {
		font-size: var(--font-size-3xl);
		color: var(--color-text);
		margin: 0;
	}

	.tagline {
		color: var(--color-text-muted);
		margin: var(--space-sm) 0 0;
	}

	.select-mode {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		min-width: 280px;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		min-width: 300px;
	}

	.form h2 {
		margin: 0;
		font-size: var(--font-size-xl);
		color: var(--color-text);
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.form-field label,
	.form-field .field-label {
		font-weight: 500;
		color: var(--color-text);
	}

	.form-actions {
		display: flex;
		gap: var(--space-md);
		justify-content: space-between;
	}

	.error {
		color: var(--color-error);
		font-size: var(--font-size-sm);
		margin: 0;
	}

	@media (max-width: 480px) {
		.form {
			min-width: 100%;
		}

		.select-mode {
			min-width: 100%;
		}
	}
</style>
