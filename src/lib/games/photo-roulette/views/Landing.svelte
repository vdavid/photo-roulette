<script lang="ts">
	import { browser } from '$app/environment';
	import { Button, Card, Input, EmojiPicker } from '$lib/common/components';
	import { ANIMAL_EMOJIS, type AnimalEmoji } from '$lib/common/types.js';
	import type { PersistedSession } from '../persistence.js';

	const STORAGE_KEY_NAME = 'photoRoulette.playerName';
	const STORAGE_KEY_EMOJI = 'photoRoulette.playerEmoji';

	interface Props {
		onHostGame: (_name: string, _emoji: string) => Promise<void>;
		onJoinGame: (_code: string, _name: string, _emoji: string) => Promise<void>;
		persistedSession?: PersistedSession | null;
		onRestoreSession?: (_session: PersistedSession) => Promise<boolean>;
		onDismissSession?: () => void;
		onBackToMenu?: () => void;
	}

	let {
		onHostGame,
		onJoinGame,
		persistedSession,
		onRestoreSession,
		onDismissSession,
		onBackToMenu,
	}: Props = $props();

	// Load saved values from localStorage, or use defaults
	function getInitialName(): string {
		if (browser) {
			return localStorage.getItem(STORAGE_KEY_NAME) || '';
		}
		return '';
	}

	function getInitialEmoji(): AnimalEmoji {
		if (browser) {
			const saved = localStorage.getItem(STORAGE_KEY_EMOJI);
			if (saved && ANIMAL_EMOJIS.includes(saved as AnimalEmoji)) {
				return saved as AnimalEmoji;
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
	let isRestoring = $state(false);
	let error = $state('');
	let sessionDismissed = $state(false);
	const showSessionBanner = $derived(!!persistedSession && !sessionDismissed);

	async function handleRestoreSession() {
		if (!persistedSession || !onRestoreSession) return;

		isRestoring = true;
		error = '';

		try {
			const success = await onRestoreSession(persistedSession);
			if (!success) {
				error = 'Failed to reconnect. The game may have ended.';
				sessionDismissed = true;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to reconnect';
			sessionDismissed = true;
		} finally {
			isRestoring = false;
		}
	}

	function handleDismissSession() {
		sessionDismissed = true;
		onDismissSession?.();
	}

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
	{#if showSessionBanner && persistedSession}
		<div class="session-banner">
			<div class="session-info">
				<strong>Reconnect to your game?</strong>
				<p>
					Room <code>{persistedSession.roomCode}</code> as {persistedSession.myName}
					{persistedSession.myEmoji}
				</p>
			</div>
			<div class="session-actions">
				<Button size="sm" onclick={handleRestoreSession} loading={isRestoring}>Reconnect</Button>
				<Button size="sm" variant="ghost" onclick={handleDismissSession} disabled={isRestoring}>
					Start fresh
				</Button>
			</div>
		</div>
	{/if}

	{#if onBackToMenu}
		<button class="back-to-menu" onclick={onBackToMenu}>
			<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
				<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
			</svg>
			All games
		</button>
	{/if}

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

	.session-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		background-color: var(--color-secondary);
		padding: var(--space-md) var(--space-lg);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		flex-wrap: wrap;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		z-index: 100;
	}

	.session-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.session-info strong {
		color: var(--color-text);
	}

	.session-info p {
		margin: 0;
		color: var(--color-text);
		font-size: var(--font-size-sm);
	}

	.session-info code {
		background-color: rgba(0, 0, 0, 0.1);
		padding: 2px 6px;
		border-radius: 4px;
		font-weight: 600;
	}

	.session-actions {
		display: flex;
		gap: var(--space-sm);
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

	.back-to-menu {
		position: absolute;
		top: var(--space-lg);
		left: var(--space-lg);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: transparent;
		border: none;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		cursor: pointer;
		transition: color var(--transition-fast);
	}

	.back-to-menu:hover {
		color: var(--color-text);
	}

	@media (max-width: 480px) {
		.form {
			min-width: 100%;
		}

		.select-mode {
			min-width: 100%;
		}

		.back-to-menu {
			top: var(--space-md);
			left: var(--space-md);
		}
	}
</style>
