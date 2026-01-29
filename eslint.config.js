import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// Svelte 5 runes are compiler directives - define them as globals
const svelteRunes = {
	$state: 'readonly',
	$derived: 'readonly',
	$effect: 'readonly',
	$props: 'readonly',
	$bindable: 'readonly',
	$inspect: 'readonly',
	$host: 'readonly',
};

export default [
	js.configs.recommended,
	prettier,
	{
		files: ['**/*.{js,ts}'],
		ignores: ['**/*.svelte.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		plugins: {
			'@typescript-eslint': ts,
		},
		rules: {
			...ts.configs.recommended.rules,
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'@typescript-eslint/no-unused-expressions': ['error', { allowTaggedTemplates: true }],
		},
	},
	{
		files: ['**/*.svelte.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
			globals: {
				...globals.browser,
				...svelteRunes,
			},
		},
		plugins: {
			'@typescript-eslint': ts,
		},
		rules: {
			...ts.configs.recommended.rules,
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'@typescript-eslint/no-unused-expressions': ['error', { allowTaggedTemplates: true }],
		},
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tsParser,
			},
			globals: {
				...globals.browser,
			},
		},
		plugins: {
			svelte,
		},
		rules: {
			...svelte.configs.recommended.rules,
			'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	},
	{
		ignores: [
			'.svelte-kit/**',
			'build/**',
			'dist/**',
			'node_modules/**',
			'*.config.js',
			'*.config.ts',
		],
	},
];
