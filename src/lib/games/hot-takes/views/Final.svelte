<script lang="ts">
	import { Button, Card } from '$lib/common/components';
	import { TakeCard } from '../components/index.js';
	import { hotTakesStore } from '../store.svelte.js';

	interface Props {
		onBackToMenu?: () => void;
	}

	let { onBackToMenu }: Props = $props();

	const { takeResults, playerScores, players, isHost, myPlayerId, takes } = $derived(hotTakesStore);

	// Calculate rankings
	const rankings = $derived(() => {
		const activePlayers = players.filter((p) => !p.isSpectator);
		const sorted = activePlayers
			.map((player) => ({
				player,
				score: playerScores.get(player.id) ?? {
					totalPoints: 0,
					correctGuesses: 0,
					controversialTakes: 0,
				},
				rank: 0,
			}))
			.sort((a, b) => b.score.totalPoints - a.score.totalPoints);

		// Assign ranks (handle ties)
		let currentRank = 1;
		for (let i = 0; i < sorted.length; i++) {
			if (i > 0 && sorted[i].score.totalPoints < sorted[i - 1].score.totalPoints) {
				currentRank = i + 1;
			}
			sorted[i].rank = currentRank;
		}

		return sorted;
	});

	// Find special takes
	const mostControversialTake = $derived(() => {
		if (takeResults.length === 0) return null;
		const sorted = [...takeResults].sort(
			(a, b) => Math.abs(50 - a.agreePercent) - Math.abs(50 - b.agreePercent)
		);
		const result = sorted[0];
		const take = takes.find((t) => t.id === result.takeId);
		const author = players.find((p) => p.id === result.authorId);
		return { result, take, author };
	});

	const mostAgreedTake = $derived(() => {
		if (takeResults.length === 0) return null;
		const sorted = [...takeResults].sort((a, b) => b.agreePercent - a.agreePercent);
		const result = sorted[0];
		const take = takes.find((t) => t.id === result.takeId);
		const author = players.find((p) => p.id === result.authorId);
		return { result, take, author };
	});

	const mostDisagreedTake = $derived(() => {
		if (takeResults.length === 0) return null;
		const sorted = [...takeResults].sort((a, b) => a.agreePercent - b.agreePercent);
		const result = sorted[0];
		const take = takes.find((t) => t.id === result.takeId);
		const author = players.find((p) => p.id === result.authorId);
		return { result, take, author };
	});

	function getRankEmoji(rank: number): string {
		switch (rank) {
			case 1:
				return '🥇';
			case 2:
				return '🥈';
			case 3:
				return '🥉';
			default:
				return '';
		}
	}

	function handlePlayAgain() {
		hotTakesStore.playAgain();
	}
</script>

<div class="final">
	<header>
		<h1>🔥 Game over!</h1>
	</header>

	<section class="rankings">
		<h2>Final rankings</h2>
		<div class="rankings-list">
			{#each rankings() as { player, score, rank }}
				<Card padding="md">
					<div class="rank-item" class:winner={rank === 1} class:is-me={player.id === myPlayerId}>
						<span class="rank-number">
							{getRankEmoji(rank) || `#${rank}`}
						</span>
						<span class="player-emoji">{player.emoji}</span>
						<div class="player-info">
							<span class="player-name">
								{player.name}
								{#if player.id === myPlayerId}
									<span class="you-badge">(you)</span>
								{/if}
							</span>
							<div class="player-stats">
								<span class="stat">{score.correctGuesses} correct guesses</span>
								<span class="stat">{score.controversialTakes} controversial takes</span>
							</div>
						</div>
						<span class="score">{score.totalPoints} pts</span>
					</div>
				</Card>
			{/each}
		</div>
	</section>

	<section class="highlights">
		<h2>Take highlights</h2>

		{#if mostControversialTake()?.take}
			<div class="highlight">
				<h3>🔥 Most controversial</h3>
				<div class="highlight-take">
					<TakeCard
						text={mostControversialTake()!.take!.text}
						authorName={mostControversialTake()!.author?.name ?? 'Unknown'}
						authorEmoji={mostControversialTake()!.author?.emoji ?? '?'}
						isRevealed={true}
						agreePercent={mostControversialTake()!.result.agreePercent}
					/>
				</div>
			</div>
		{/if}

		{#if mostAgreedTake()?.take}
			<div class="highlight">
				<h3>👍 Most agreed</h3>
				<div class="highlight-take">
					<TakeCard
						text={mostAgreedTake()!.take!.text}
						authorName={mostAgreedTake()!.author?.name ?? 'Unknown'}
						authorEmoji={mostAgreedTake()!.author?.emoji ?? '?'}
						isRevealed={true}
						agreePercent={mostAgreedTake()!.result.agreePercent}
					/>
				</div>
			</div>
		{/if}

		{#if mostDisagreedTake()?.take}
			<div class="highlight">
				<h3>👎 Most disagreed</h3>
				<div class="highlight-take">
					<TakeCard
						text={mostDisagreedTake()!.take!.text}
						authorName={mostDisagreedTake()!.author?.name ?? 'Unknown'}
						authorEmoji={mostDisagreedTake()!.author?.emoji ?? '?'}
						isRevealed={true}
						agreePercent={mostDisagreedTake()!.result.agreePercent}
					/>
				</div>
			</div>
		{/if}
	</section>

	<footer>
		{#if isHost}
			<Button onclick={handlePlayAgain} variant="primary" size="lg">Play again</Button>
		{:else}
			<p class="waiting">Waiting for host to start new game...</p>
		{/if}

		{#if onBackToMenu}
			<Button onclick={onBackToMenu} variant="ghost">Back to menu</Button>
		{/if}
	</footer>
</div>

<style>
	.final {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-xl);
		gap: var(--space-xl);
	}

	header {
		text-align: center;
	}

	h1 {
		font-size: var(--font-size-3xl);
		color: var(--color-text);
	}

	section {
		width: 100%;
		max-width: 500px;
	}

	h2 {
		font-size: var(--font-size-lg);
		color: var(--color-text);
		margin-bottom: var(--space-md);
		text-align: center;
	}

	.rankings-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.rank-item {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.rank-item.winner {
		background: linear-gradient(
			135deg,
			color-mix(in srgb, gold 10%, var(--color-surface)),
			color-mix(in srgb, orange 10%, var(--color-surface))
		);
	}

	.rank-item.is-me {
		border-left: 3px solid var(--color-primary);
	}

	.rank-number {
		font-size: var(--font-size-xl);
		font-weight: 700;
		min-width: 40px;
		text-align: center;
	}

	.player-emoji {
		font-size: 2rem;
	}

	.player-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.player-name {
		font-weight: 600;
		color: var(--color-text);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.you-badge {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-weight: 400;
	}

	.player-stats {
		display: flex;
		gap: var(--space-md);
	}

	.stat {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.score {
		font-size: var(--font-size-xl);
		font-weight: 700;
		color: var(--color-primary);
	}

	.highlights {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.highlight h3 {
		font-size: var(--font-size-base);
		color: var(--color-text-muted);
		margin-bottom: var(--space-sm);
		text-align: center;
	}

	.highlight-take {
		display: flex;
		justify-content: center;
	}

	footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
		margin-top: var(--space-lg);
	}

	.waiting {
		color: var(--color-text-muted);
	}
</style>
