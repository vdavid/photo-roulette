<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Button } from '$lib/components';
	import type { Player, PlayerId, FinalResults, RoundResult } from '$lib/game/types.js';

	interface Props {
		results: FinalResults;
		players: Player[];
		isHost: boolean;
		roundResults: RoundResult[];
		gamePhotoUrls: Map<string, string>;
		onRematch: () => void;
		onNewGame: () => void;
		onLeaveGame: () => void;
	}

	let {
		results,
		players,
		isHost,
		roundResults,
		gamePhotoUrls,
		onRematch,
		onNewGame,
		onLeaveGame,
	}: Props = $props();

	let showConfetti = $state(false);
	let currentSlideIndex = $state(0);
	let slideInterval: ReturnType<typeof setInterval> | null = null;

	// Calculate slide index based on wall-clock time so all players see the same photo
	function calculateSlideIndex(photoCount: number): number {
		if (photoCount === 0) return 0;
		// Use wall-clock time divided by 4 seconds, modulo photo count
		// This ensures all players with synced clocks see the same slide
		return Math.floor(Date.now() / 4000) % photoCount;
	}

	// Get player info helper
	function getPlayer(playerId: PlayerId): Player | undefined {
		return players.find((p) => p.id === playerId);
	}

	const podium = $derived(results.rankings.slice(0, 3));
	const others = $derived(results.rankings.slice(3));

	// Get all game photos as array for slideshow
	const allGamePhotos = $derived(Array.from(gamePhotoUrls.entries()).map(([id, url]) => ({ id, url })));

	// Calculate photos for each superlative type
	const superlativePhotos = $derived.by(() => {
		const photos: Record<string, string[]> = {
			fastestFingers: [],
			mostFeatured: [],
			sharpshooter: [],
			luckyGuesser: [],
		};

		for (const superlative of results.superlatives) {
			const playerId = superlative.playerId;

			for (const round of roundResults) {
				const photoUrl = gamePhotoUrls.get(round.photoId);
				if (!photoUrl) continue;

				const playerScore = round.scores.find((s) => s.playerId === playerId);
				if (!playerScore) continue;

				// Fastest fingers: rounds where this player was fastest
				if (superlative.type === 'fastestFingers' && playerScore.isFastest) {
					photos.fastestFingers.push(photoUrl);
				}

				// Most featured: rounds where this player's photo was shown
				if (superlative.type === 'mostFeatured' && round.photoOwnerId === playerId) {
					photos.mostFeatured.push(photoUrl);
				}

				// Sharpshooter: rounds where this player guessed correctly
				if (superlative.type === 'sharpshooter' && playerScore.correctGuess) {
					photos.sharpshooter.push(photoUrl);
				}

				// Lucky guesser: also correctly guessed photos
				if (superlative.type === 'luckyGuesser' && playerScore.correctGuess) {
					photos.luckyGuesser.push(photoUrl);
				}
			}
		}

		return photos;
	});

	// Get photos for a specific superlative type (max 4)
	function getSuperlativePhotos(type: string): string[] {
		return (superlativePhotos[type] || []).slice(0, 4);
	}

	onMount(() => {
		// Trigger confetti animation
		showConfetti = true;
		setTimeout(() => {
			showConfetti = false;
		}, 5000);

		// Start slideshow - use wall-clock time so all players are in sync
		if (allGamePhotos.length > 0) {
			// Set initial index based on current time
			currentSlideIndex = calculateSlideIndex(allGamePhotos.length);

			// Update every 100ms to stay in sync (checks if we need to change slide)
			slideInterval = setInterval(() => {
				currentSlideIndex = calculateSlideIndex(allGamePhotos.length);
			}, 100);
		}
	});

	onDestroy(() => {
		if (slideInterval) {
			clearInterval(slideInterval);
		}
	});
</script>

<div class="final">
	{#if showConfetti}
		<div class="confetti-container">
			{#each Array(50) as _item}
				<div
					class="confetti"
					style="
						left: {Math.random() * 100}%;
						animation-delay: {Math.random() * 2}s;
						background-color: {['#c85a35', '#e8a54b', '#5b8c5a', '#b54a4a'][Math.floor(Math.random() * 4)]};
					"
				></div>
			{/each}
		</div>
	{/if}

	<header class="header">
		<h1>Game over!</h1>
	</header>

	<section class="podium-section">
		<div class="podium">
			{#if podium[1]}
				{@const player = getPlayer(podium[1].playerId)}
				<div class="podium-place second">
					<div class="medal">🥈</div>
					<div class="player-avatar">{player?.emoji}</div>
					<div class="player-name">{player?.name}</div>
					<div class="player-score">{podium[1].totalPoints}</div>
					<div class="pedestal second-pedestal"></div>
				</div>
			{/if}

			{#if podium[0]}
				{@const player = getPlayer(podium[0].playerId)}
				<div class="podium-place first">
					<div class="crown">👑</div>
					<div class="medal">🥇</div>
					<div class="player-avatar winner">{player?.emoji}</div>
					<div class="player-name">{player?.name}</div>
					<div class="player-score">{podium[0].totalPoints}</div>
					<div class="pedestal first-pedestal"></div>
				</div>
			{/if}

			{#if podium[2]}
				{@const player = getPlayer(podium[2].playerId)}
				<div class="podium-place third">
					<div class="medal">🥉</div>
					<div class="player-avatar">{player?.emoji}</div>
					<div class="player-name">{player?.name}</div>
					<div class="player-score">{podium[2].totalPoints}</div>
					<div class="pedestal third-pedestal"></div>
				</div>
			{/if}
		</div>
	</section>

	{#if others.length > 0}
		<section class="others-section">
			{#each others as score, index (score.playerId)}
				{@const player = getPlayer(score.playerId)}
				<div class="other-row">
					<span class="rank">{index + 4}.</span>
					<span class="player-emoji">{player?.emoji}</span>
					<span class="player-name">{player?.name}</span>
					<span class="player-score">{score.totalPoints} pts</span>
				</div>
			{/each}
		</section>
	{/if}

	{#if results.superlatives.length > 0}
		<section class="superlatives-section">
			<h2>Awards</h2>

			<div class="superlatives-grid">
				{#each results.superlatives as superlative}
					{@const player = getPlayer(superlative.playerId)}
					{@const photos = getSuperlativePhotos(superlative.type)}
					<div class="superlative-card">
						<div class="superlative-emoji">{player?.emoji}</div>
						<div class="superlative-label">{superlative.label}</div>
						<div class="superlative-name">{player?.name}</div>
						<div class="superlative-value">{superlative.value}</div>
						{#if photos.length > 0}
							<div class="superlative-photos">
								{#each photos as photoUrl}
									<div class="superlative-photo">
										<img src={photoUrl} alt="" />
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if allGamePhotos.length > 0}
		<section class="slideshow-section">
			<div class="slideshow-container">
				{#each allGamePhotos as photo, index (photo.id)}
					<div class="slide" class:active={index === currentSlideIndex}>
						<img src={photo.url} alt="" />
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<footer class="footer">
		{#if isHost}
			<Button size="lg" fullWidth onclick={onRematch}>Rematch</Button>
			<Button size="lg" variant="secondary" fullWidth onclick={onNewGame}>New game</Button>
		{:else}
			<div class="waiting-message">Waiting for host...</div>
		{/if}
		<Button size="lg" variant="ghost" fullWidth onclick={onLeaveGame}>Leave game</Button>
	</footer>
</div>

<style>
	.final {
		min-height: 100vh;
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		max-width: 600px;
		margin: 0 auto;
		position: relative;
		overflow: hidden;
	}

	.confetti-container {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 100;
	}

	.confetti {
		position: absolute;
		top: -10px;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		animation: fall 4s linear forwards;
	}

	@keyframes fall {
		to {
			top: 100vh;
			transform: rotate(720deg);
		}
	}

	.header {
		text-align: center;
	}

	.header h1 {
		font-size: var(--font-size-3xl);
		margin: 0;
	}

	.podium-section {
		padding: var(--space-xl) 0;
	}

	.podium {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: var(--space-md);
	}

	.podium-place {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
	}

	.crown {
		font-size: 2rem;
		animation: bounce 1s ease-in-out infinite;
	}

	@keyframes bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-5px);
		}
	}

	.medal {
		font-size: 1.5rem;
	}

	.player-avatar {
		font-size: 2.5rem;
		width: 60px;
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface);
		border-radius: 50%;
	}

	.player-avatar.winner {
		font-size: 3rem;
		width: 80px;
		height: 80px;
		box-shadow: 0 0 20px rgba(232, 165, 75, 0.5);
	}

	.podium-place .player-name {
		font-weight: 600;
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.podium-place .player-score {
		font-size: var(--font-size-lg);
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.pedestal {
		width: 80px;
		background: linear-gradient(to bottom, var(--color-secondary), var(--color-secondary-hover));
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		margin-top: var(--space-sm);
	}

	.first-pedestal {
		height: 100px;
	}

	.second-pedestal {
		height: 70px;
	}

	.third-pedestal {
		height: 50px;
	}

	.others-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.other-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border-radius: var(--radius-sm);
	}

	.rank {
		min-width: 2rem;
		color: var(--color-text-muted);
	}

	.player-emoji {
		font-size: 1.25rem;
	}

	.player-name {
		flex: 1;
	}

	.player-score {
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.superlatives-section h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--font-size-lg);
	}

	.superlatives-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--space-md);
	}

	.superlative-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-md);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		text-align: center;
	}

	.superlative-emoji {
		font-size: 2rem;
	}

	.superlative-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.superlative-name {
		font-weight: 600;
	}

	.superlative-value {
		font-size: var(--font-size-sm);
		color: var(--color-primary);
	}

	.superlative-photos {
		display: flex;
		gap: 4px;
		justify-content: center;
		margin-top: var(--space-sm);
		flex-wrap: wrap;
	}

	.superlative-photo {
		width: 36px;
		height: 36px;
		border-radius: 4px;
		overflow: hidden;
	}

	.superlative-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.slideshow-section {
		margin-top: var(--space-lg);
	}

	.slideshow-container {
		position: relative;
		width: 100%;
		height: 200px;
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--color-surface);
	}

	.slide {
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity 400ms ease-in-out;
	}

	.slide.active {
		opacity: 1;
	}

	.slide img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: var(--color-surface);
	}

	.footer {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		margin-top: auto;
		padding-top: var(--space-lg);
	}

	.waiting-message {
		text-align: center;
		padding: var(--space-md);
		color: var(--color-text-muted);
	}
</style>
