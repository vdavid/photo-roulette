<script lang="ts">
	import { Button, Card, Input, EmojiPicker } from '$lib/common/components';
	import { ANIMAL_EMOJIS, type AnimalEmoji } from '$lib/common/types.js';
	import { hotTakesStore } from '../store.svelte.js';

	interface Props {
		onBackToMenu?: () => void;
	}

	let { onBackToMenu }: Props = $props();

	let name = $state('');
	let emoji = $state<AnimalEmoji>(ANIMAL_EMOJIS[Math.floor(Math.random() * ANIMAL_EMOJIS.length)]);
	let joinCode = $state('');
	let isHosting = $state(false);
	let isJoining = $state(false);
	let error = $state<string | null>(null);

	async function handleHost() {
		if (!name.trim()) {
			error = 'Please enter your name';
			return;
		}

		isHosting = true;
		error = null;

		try {
			await hotTakesStore.hostGame(name.trim(), emoji);
		} catch (e) {
			error = (e as Error).message;
			isHosting = false;
		}
	}

	async function handleJoin() {
		if (!name.trim()) {
			error = 'Please enter your name';
			return;
		}
		if (!joinCode.trim()) {
			error = 'Please enter a room code';
			return;
		}

		isJoining = true;
		error = null;

		try {
			await hotTakesStore.joinGame(joinCode.trim().toUpperCase(), name.trim(), emoji);
		} catch (e) {
			error = (e as Error).message;
			isJoining = false;
		}
	}
</script>

<div class="landing">
	{#if onBackToMenu}
		<button class="back-btn" onclick={onBackToMenu}>
			<span class="back-arrow">←</span>
			<span>All games</span>
		</button>
	{/if}

	<header>
		<h1>🔥 Hot Takes</h1>
		<p class="tagline">Share your spiciest opinions</p>
	</header>

	<Card padding="lg">
		<div class="setup-form">
			<div class="form-section">
				<label for="name-input">Your name</label>
				<Input id="name-input" bind:value={name} placeholder="Enter your name" maxlength={20} />
			</div>

			<div class="form-section">
				<span class="label-text">Your emoji</span>
				<EmojiPicker selected={emoji} onselect={(e) => (emoji = e)} />
			</div>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<div class="actions">
				<Button onclick={handleHost} disabled={isHosting || isJoining} variant="primary" size="lg">
					{isHosting ? 'Creating...' : 'Host game'}
				</Button>

				<div class="join-section">
					<span class="divider">or join with code</span>
					<div class="join-row">
						<div class="join-code-input">
							<Input bind:value={joinCode} placeholder="CODE" maxlength={4} />
						</div>
						<Button onclick={handleJoin} disabled={isHosting || isJoining} variant="secondary">
							{isJoining ? 'Joining...' : 'Join'}
						</Button>
					</div>
				</div>
			</div>
		</div>
	</Card>

	<div class="how-to-play">
		<h2>How to play</h2>
		<ol>
			<li>Everyone submits their controversial "hot takes"</li>
			<li>Vote on each take: Agree or Disagree</li>
			<li>Guess who wrote each take</li>
			<li>Earn points for correct guesses and controversial takes!</li>
		</ol>
	</div>
</div>

<style>
	.landing {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-xl);
		gap: var(--space-xl);
	}

	.back-btn {
		position: absolute;
		top: var(--space-lg);
		left: var(--space-lg);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.back-btn:hover {
		color: var(--color-text);
		border-color: var(--color-text-muted);
	}

	.back-arrow {
		font-size: var(--font-size-lg);
	}

	header {
		text-align: center;
	}

	h1 {
		font-size: var(--font-size-3xl);
		color: var(--color-text);
		margin-bottom: var(--space-sm);
	}

	.tagline {
		color: var(--color-text-muted);
		font-size: var(--font-size-lg);
	}

	.setup-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		width: 100%;
		max-width: 320px;
	}

	.form-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.form-section label {
		font-weight: 500;
		color: var(--color-text);
	}

	.error {
		color: var(--color-error);
		font-size: var(--font-size-sm);
		text-align: center;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		margin-top: var(--space-md);
	}

	.join-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.divider {
		text-align: center;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	.join-row {
		display: flex;
		gap: var(--space-sm);
	}

	.join-code-input {
		flex: 1;
	}

	.join-code-input :global(input) {
		text-transform: uppercase;
		text-align: center;
		font-size: 1.25rem;
		letter-spacing: 0.1em;
	}

	.label-text {
		font-weight: 500;
		color: var(--color-text);
	}

	.how-to-play {
		text-align: center;
		max-width: 400px;
		color: var(--color-text-muted);
	}

	.how-to-play h2 {
		font-size: var(--font-size-lg);
		color: var(--color-text);
		margin-bottom: var(--space-md);
	}

	.how-to-play ol {
		text-align: left;
		padding-left: var(--space-lg);
	}

	.how-to-play li {
		margin-bottom: var(--space-sm);
	}
</style>
