<script lang="ts">
	import { Button, Card, Input, EmojiPicker } from '$lib/components';
	import { ANIMAL_EMOJIS } from '$lib/game/constants.js';

	interface Props {
		onHostGame: (_name: string, _emoji: string) => Promise<void>;
		onJoinGame: (_code: string, _name: string, _emoji: string) => Promise<void>;
	}

	let { onHostGame, onJoinGame }: Props = $props();

	let mode = $state<'select' | 'host' | 'join'>('select');
	let name = $state('');
	let emoji = $state(ANIMAL_EMOJIS[Math.floor(Math.random() * ANIMAL_EMOJIS.length)]);
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
		<span class="logo-emoji">📸</span>
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

	.logo-emoji {
		font-size: 4rem;
		display: block;
		margin-bottom: var(--space-md);
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
