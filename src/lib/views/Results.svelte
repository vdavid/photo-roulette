<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Player, PlayerId, RoundResult, PlayerScore } from '$lib/game/types.js';
	import { ROUND_RESULT_DISPLAY_MS } from '$lib/game/constants.js';

	interface Props {
		result: RoundResult;
		players: Player[];
		playerScores: Map<PlayerId, PlayerScore>;
		currentRoundNumber: number;
		totalRounds: number;
		photoUrl: string | null;
	}

	let { result, players, playerScores, currentRoundNumber, totalRounds, photoUrl }: Props =
		$props();

	// Countdown timer
	let countdown = $state(Math.ceil(ROUND_RESULT_DISPLAY_MS / 1000));
	let countdownInterval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		countdownInterval = setInterval(() => {
			countdown = Math.max(0, countdown - 1);
		}, 1000);
	});

	onDestroy(() => {
		if (countdownInterval) {
			clearInterval(countdownInterval);
		}
	});

	const photoOwner = $derived(players.find((p) => p.id === result.photoOwnerId));

	// Get player info helper
	function getPlayer(playerId: PlayerId): Player | undefined {
		return players.find((p) => p.id === playerId);
	}

	// Get what a player guessed
	function getGuess(playerId: PlayerId) {
		return result.guesses.find((g) => g.playerId === playerId);
	}

	// Get score for this round
	function getRoundScore(playerId: PlayerId) {
		return result.scores.find((s) => s.playerId === playerId);
	}

	// Sort players by total score (descending)
	const rankedPlayers = $derived(
		[...players].sort((a, b) => {
			const scoreA = playerScores.get(a.id)?.totalPoints || 0;
			const scoreB = playerScores.get(b.id)?.totalPoints || 0;
			return scoreB - scoreA;
		})
	);
</script>

<div class="results">
	<header class="header">
		<div class="round-complete">Round {currentRoundNumber} complete</div>
		<div class="round-progress">{currentRoundNumber} of {totalRounds}</div>
	</header>

	<div class="photo-owner">
		{#if photoUrl}
			<div class="photo-thumbnail">
				<img src={photoUrl} alt="Round photo" />
			</div>
		{/if}
		<div class="owner-info">
			<span class="owner-emoji">{photoOwner?.emoji}</span>
			<span class="owner-text">It was <strong>{photoOwner?.name}</strong>'s photo!</span>
		</div>
	</div>

	<section class="guesses-section">
		<h2>Guesses</h2>

		<div class="guesses-list">
			{#each players as player (player.id)}
				{@const guess = getGuess(player.id)}
				{@const guessedPlayer = guess ? getPlayer(guess.guessedOwnerId) : null}
				{@const roundScore = getRoundScore(player.id)}
				{@const isCorrect = roundScore?.correctGuess}
				{@const isFastest = roundScore?.isFastest}
				{@const isFeatured = roundScore?.isFeatured}
				{@const points = roundScore?.points || 0}

				<div class="guess-row" class:correct={isCorrect} class:featured={isFeatured}>
					<div class="guesser">
						<span class="player-emoji">{player.emoji}</span>
						<span class="player-name">{player.name}</span>
						{#if isFeatured}
							<span class="featured-badge">★</span>
						{/if}
					</div>

					<div class="guess-details">
						{#if isFeatured && !guess}
							<span class="guess-target featured-text">Photo featured</span>
						{:else if guess}
							<span class="guess-arrow">→</span>
							<span class="guess-target">{guessedPlayer?.name || 'Unknown'}</span>
							{#if isCorrect}
								<span class="correct-mark">✓</span>
							{:else}
								<span class="wrong-mark">✗</span>
							{/if}
						{:else}
							<span class="no-guess">(no guess)</span>
						{/if}
					</div>

					<div class="points">
						{#if points > 0}
							<span class="points-value">+{points}</span>
							{#if isFastest}
								<span class="fastest-badge">Fastest!</span>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="leaderboard-section">
		<h2>Leaderboard</h2>

		<div class="leaderboard">
			{#each rankedPlayers as player, index (player.id)}
				{@const score = playerScores.get(player.id)}
				<div class="leaderboard-row" class:top-three={index < 3}>
					<span class="rank">
						{#if index === 0}
							🥇
						{:else if index === 1}
							🥈
						{:else if index === 2}
							🥉
						{:else}
							{index + 1}.
						{/if}
					</span>
					<span class="player-emoji">{player.emoji}</span>
					<span class="player-name">{player.name}</span>
					<span class="total-points">{score?.totalPoints || 0}</span>
				</div>
			{/each}
		</div>
	</section>

	<div class="next-round-hint">
		<span class="loading-dot"></span>
		{#if currentRoundNumber >= totalRounds}
			Final results in {countdown}...
		{:else}
			Next round starting in {countdown}...
		{/if}
	</div>
</div>

<style>
	.results {
		min-height: 100vh;
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		max-width: 600px;
		margin: 0 auto;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.round-complete {
		font-size: var(--font-size-lg);
		font-weight: 500;
	}

	.round-progress {
		color: var(--color-text-muted);
	}

	.photo-owner {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		padding: var(--space-lg);
		background: var(--color-secondary);
		border-radius: var(--radius-lg);
		text-align: center;
	}

	.photo-thumbnail {
		width: 120px;
		height: 120px;
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.photo-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.owner-info {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.owner-emoji {
		font-size: 2.5rem;
	}

	.owner-text {
		font-size: var(--font-size-xl);
	}

	.guesses-section h2,
	.leaderboard-section h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--font-size-lg);
	}

	.guesses-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.guess-row {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border-radius: var(--radius-sm);
	}

	.guess-row.correct {
		background: rgba(91, 140, 90, 0.1);
	}

	.guess-row.featured {
		background: rgba(232, 165, 75, 0.15);
	}

	.guesser {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-width: 120px;
	}

	.player-emoji {
		font-size: 1.25rem;
	}

	.player-name {
		font-weight: 500;
	}

	.featured-badge {
		color: var(--color-secondary-hover);
		font-weight: bold;
	}

	.guess-details {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex: 1;
		color: var(--color-text-muted);
	}

	.guess-arrow {
		color: var(--color-text-muted);
	}

	.guess-target {
		color: var(--color-text);
	}

	.featured-text {
		color: var(--color-secondary-hover);
		font-style: italic;
	}

	.correct-mark {
		color: var(--color-success);
		font-weight: bold;
	}

	.wrong-mark {
		color: var(--color-error);
	}

	.no-guess {
		font-style: italic;
	}

	.points {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-width: 80px;
		justify-content: flex-end;
	}

	.points-value {
		font-weight: 600;
		color: var(--color-success);
	}

	.fastest-badge {
		font-size: var(--font-size-sm);
		color: var(--color-primary);
		font-weight: 500;
	}

	.leaderboard {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.leaderboard-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--color-surface);
		border-radius: var(--radius-sm);
	}

	.leaderboard-row.top-three {
		background: rgba(232, 165, 75, 0.1);
	}

	.rank {
		min-width: 2rem;
		font-weight: 500;
	}

	.total-points {
		margin-left: auto;
		font-weight: 600;
		color: var(--color-text);
	}

	.next-round-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-md);
		color: var(--color-text-muted);
		margin-top: auto;
	}

	.loading-dot {
		width: 8px;
		height: 8px;
		background: var(--color-primary);
		border-radius: 50%;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
