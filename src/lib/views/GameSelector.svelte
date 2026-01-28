<script lang="ts">
	import { Card } from '$lib/common/components';
	import { getAllGames } from '$lib/common';

	interface Props {
		onSelectGame: (_gameId: string) => void;
	}

	let { onSelectGame }: Props = $props();

	const games = getAllGames();
</script>

<div class="game-selector">
	<header>
		<h1>Party games</h1>
		<p class="tagline">Pick a game to play with friends</p>
	</header>

	<div class="games-grid">
		{#each games as game}
			<button class="game-card" onclick={() => onSelectGame(game.id)}>
				<Card padding="lg">
					<div class="game-content">
						<span class="game-icon">{game.icon}</span>
						<h2 class="game-name">{game.name}</h2>
						<p class="game-description">{game.description}</p>
						<div class="game-meta">
							<span class="player-count">{game.minPlayers}-{game.maxPlayers} players</span>
						</div>
					</div>
				</Card>
			</button>
		{/each}
	</div>
</div>

<style>
	.game-selector {
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
		margin-bottom: var(--space-sm);
	}

	.tagline {
		color: var(--color-text-muted);
		font-size: var(--font-size-lg);
	}

	.games-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--space-lg);
		max-width: 800px;
		width: 100%;
	}

	.game-card {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		transition: transform var(--transition-fast);
	}

	.game-card:hover {
		transform: translateY(-4px);
	}

	.game-card:active {
		transform: translateY(-2px);
	}

	.game-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.game-icon {
		font-size: 3rem;
	}

	.game-name {
		font-size: var(--font-size-xl);
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
	}

	.game-description {
		color: var(--color-text-muted);
		font-size: var(--font-size-base);
		line-height: 1.5;
		margin: 0;
	}

	.game-meta {
		margin-top: var(--space-sm);
	}

	.player-count {
		font-size: var(--font-size-sm);
		color: var(--color-primary);
		font-weight: 500;
	}
</style>
