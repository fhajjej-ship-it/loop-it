# Codex

Install Loop it into a project:

```bash
npx @fhajjej/loop-it@latest install --agent codex --scope project
```

This creates:

```text
.agents/skills/loop-it/SKILL.md
```

Run the command from the project root, or pass `--cwd /real/path/to/your-project`.

Invoke it in Codex:

```text
Use $loop-it to create a bounded repair loop for this bug.
```

Generate a Codex launch prompt:

```bash
npx @fhajjej/loop-it@latest start \
  --goal "Fix failing checkout tests" \
  --check "npm test -- checkout" \
  --agent codex
```

Codex launch behavior:

- For interactive finish-line work, Loop it generates a preferred native `/goal` command with the goal, verifier, iteration cap, stop conditions, and approval gates.
- Native Goal state owns the live running, paused, and completed lifecycle. `.loop-it` remains the portable contract and evidence record.
- It also creates portable `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md` files.
- Those files are the contract, not the repair. Paste the native Goal command or fallback prompt before expecting changed files.
- If `/goal` is unavailable, enable `features.goals` in Codex or use the generated normal-message fallback. The fallback remains fully usable without `$loop-it`.
- `loop-it run --execute codex` remains the non-interactive bounded runner and does not require native Goals.

See OpenAI's [Follow a goal](https://developers.openai.com/codex/use-cases/follow-goals) guide for native Goal lifecycle commands and feature enablement.

Recommended Codex use:

- repo-grounded bug fixes;
- PR hardening;
- docs sweeps;
- release-readiness loops;
- one bounded verification pass at a time.
