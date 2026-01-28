<script lang="ts">
	import type { Player } from '$lib/game/types.js';
	import { MIN_PHOTOS_PER_PLAYER } from '$lib/game/constants.js';

	interface Props {
		player: Player;
		isCurrentPlayer?: boolean;
		showReadyState?: boolean;
	}

	let { player, isCurrentPlayer = false, showReadyState = true }: Props = $props();

	const photoCount = $derived(player.photoIds.length);
	const hasEnoughPhotos = $derived(photoCount >= MIN_PHOTOS_PER_PLAYER);
</script>

<div
	class="player-card"
	class:current={isCurrentPlayer}
	class:disconnected={!player.isConnected}
	class:ready={player.isReady && showReadyState}
>
	<div class="avatar">
		<span class="emoji">{player.emoji}</span>
		{#if player.isHost}
			<span class="host-badge" title="Host">
				<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
					<path
						d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
					/>
				</svg>
			</span>
		{/if}
	</div>

	<div class="info">
		<span class="name">{player.name || 'Unnamed'}</span>
		{#if showReadyState}
			<span class="status" class:has-photos={hasEnoughPhotos}>
				{#if !player.isConnected}
					Disconnected
				{:else if photoCount === 0}
					No photos
				{:else}
					{photoCount} photos
				{/if}
			</span>
		{/if}
	</div>

	{#if showReadyState && player.isConnected}
		<div class="ready-indicator" class:is-ready={player.isReady}>
			{#if player.isReady}
				<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
					<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
				</svg>
			{/if}
		</div>
	{/if}
</div>

<style>
	.player-card {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md);
		background-color: var(--color-surface);
		border-radius: var(--radius-md);
		border: 2px solid transparent;
		transition:
			border-color var(--transition-fast),
			opacity var(--transition-fast);
	}

	.player-card.current {
		border-color: var(--color-primary);
	}

	.player-card.disconnected {
		opacity: 0.5;
	}

	.player-card.ready {
		background-color: rgba(91, 140, 90, 0.1);
	}

	.avatar {
		position: relative;
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--color-background);
		border-radius: var(--radius-full);
	}

	.emoji {
		font-size: 1.75rem;
	}

	.host-badge {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--color-secondary);
		border-radius: var(--radius-full);
		color: var(--color-text);
	}

	.info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		min-width: 0;
	}

	.name {
		font-weight: 500;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.status.has-photos {
		color: var(--color-success);
	}

	.ready-indicator {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--color-text-muted);
		border-radius: var(--radius-full);
		color: var(--color-text-muted);
	}

	.ready-indicator.is-ready {
		border-color: var(--color-success);
		background-color: var(--color-success);
		color: white;
	}
</style>
