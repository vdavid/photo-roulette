<script lang="ts">
	import { ANIMAL_EMOJIS } from '$lib/game/constants.js';
	import type { AnimalEmoji } from '$lib/game/types.js';

	interface Props {
		selected: AnimalEmoji;
		onselect: (_emoji: AnimalEmoji) => void;
	}

	let { selected, onselect }: Props = $props();
</script>

<div class="emoji-picker" role="listbox" aria-label="Choose your emoji">
	{#each ANIMAL_EMOJIS as emoji}
		<button
			type="button"
			class="emoji-button"
			class:selected={emoji === selected}
			role="option"
			aria-selected={emoji === selected}
			onclick={() => onselect(emoji)}
		>
			{emoji}
		</button>
	{/each}
</div>

<style>
	.emoji-picker {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		padding: var(--space-sm);
		background-color: var(--color-background);
		border-radius: var(--radius-md);
	}

	.emoji-button {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			border-color var(--transition-fast),
			background-color var(--transition-fast);
	}

	.emoji-button:hover {
		transform: scale(1.1);
		background-color: var(--color-secondary);
	}

	.emoji-button.selected {
		border-color: var(--color-primary);
		background-color: var(--color-secondary);
		transform: scale(1.1);
	}

	.emoji-button:focus-visible {
		outline: none;
		border-color: var(--color-primary);
	}
</style>
