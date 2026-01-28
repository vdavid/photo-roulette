# Agent guidelines

## ⚠️ Critical rules (read first)

1. **Use `pnpm`**: not npm, not yarn. Always `pnpm install`, `pnpm add`, `pnpm run`.
2. **Use LATEST package versions**: always check npm for current versions before installing. Don't rely on training data, it's outdated. Run `pnpm add package@latest` or check https://www.npmjs.com/ for the current version.
3. **Sentence case everywhere**: all headings, labels, buttons, UI text must use Sentence case (NOT Title Case). "Start game" not "Start Game". "Connect your photos" not "Connect Your Photos".
4. **Read the docs**: Read CONTRIBUTING.md, docs/spec/tech.md, docs/spec/game.md, and @docs/spec/tasks.md to get oriented!!!

---

## 🚨 Before committing: run `pnpm validate`

```bash
pnpm validate
```

This single command runs **all checks** in sequence and **fast-fails** on any error:

1. `prettier --write .` — format all files
2. `eslint . --fix` — lint and auto-fix
3. `tsc --noEmit` — TypeScript type checking
4. `svelte-check` — Svelte-specific checks
5. `vitest run` — unit tests

**Always run this before committing or opening a PR.**

---

## Writing style

- Keep the tone **friendly and informal**: this is a game for friends, built by friends
- Be warm, playful, and human — no corporate speak, no stiff formality
- When in doubt, write like you're texting a friend (but still clear and helpful)

## Code style

- Prefer clarity over cleverness
- Keep components small and focused
- Use descriptive variable names
- Comments only when the "why" isn't obvious

## Modularity

- **Separate concerns**: UI components, game logic, networking, and state management should live in different modules
- **No god files**: if a file exceeds ~400 lines, consider splitting it
- **Clear interfaces**: define TypeScript types for all data flowing between modules
- **Testable units**: game logic should be pure functions where possible, independent of Svelte or PeerJS
- **Extract constants**: hard-coded values (timers, thresholds, limits, feature toggles) should be extracted into a constants file for easy tweaking — no magic numbers buried in logic

## Testing

- **Good test coverage on game logic**: scoring, round progression, timer behavior, edge cases
- Game logic should be pure functions that are easy to test without mocking Svelte or PeerJS
- Use Vitest (comes with SvelteKit)
- Tests live next to the code they test: `foo.ts` → `foo.test.ts`
- Run tests before committing: `pnpm test`

## UI/UX principles

- Simple and clean — don't over-design
- Mobile-friendly but laptop-first (our friends use laptops)
- Fast feedback — show loading states, confirmations
- Embrace the chaos of friends playing together
