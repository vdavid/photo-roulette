<script lang="ts">
	type AutocompleteValue =
		| 'off'
		| 'on'
		| 'name'
		| 'email'
		| 'username'
		| 'new-password'
		| 'current-password'
		| 'one-time-code';

	interface Props {
		type?: 'text' | 'number' | 'email' | 'password';
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		error?: string;
		maxlength?: number;
		autocomplete?: AutocompleteValue;
		autofocus?: boolean;
		id?: string;
		onchange?: (_value: string) => void;
		oninput?: (_value: string) => void;
	}

	let {
		type = 'text',
		value = $bindable(''),
		placeholder = '',
		disabled = false,
		error = '',
		maxlength,
		autocomplete,
		autofocus = false,
		id,
		onchange,
		oninput,
	}: Props = $props();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		oninput?.(target.value);
	}

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		onchange?.(target.value);
	}
</script>

<div class="input-wrapper">
	<!-- svelte-ignore a11y_autofocus -->
	<input
		class="input"
		class:has-error={!!error}
		{type}
		{value}
		{placeholder}
		{disabled}
		{maxlength}
		{autocomplete}
		{id}
		autofocus={autofocus ? true : undefined}
		oninput={handleInput}
		onchange={handleChange}
	/>
	{#if error}
		<span class="error-message">{error}</span>
	{/if}
</div>

<style>
	.input-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.input {
		padding: var(--space-sm) var(--space-md);
		font-family: inherit;
		font-size: var(--font-size-base);
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		background-color: var(--color-background);
		color: var(--color-text);
		min-height: 44px;
		transition:
			border-color var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(200, 90, 53, 0.15);
	}

	.input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.input::placeholder {
		color: var(--color-text-muted);
	}

	.input.has-error {
		border-color: var(--color-error);
	}

	.input.has-error:focus {
		box-shadow: 0 0 0 3px rgba(181, 74, 74, 0.15);
	}

	.error-message {
		color: var(--color-error);
		font-size: var(--font-size-sm);
	}
</style>
