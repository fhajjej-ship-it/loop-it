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

- For finish-line work, Loop it generates a `/goal` prompt with the goal, verifier, iteration cap, stop conditions, and approval gates.
- It also creates portable `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md` files.
- If `/goal` is unavailable in the current Codex host, use the fallback prompt in `.loop-it/LAUNCH.md` and run one bounded iteration at a time.

Recommended Codex use:

- repo-grounded bug fixes;
- PR hardening;
- docs sweeps;
- release-readiness loops;
- one bounded verification pass at a time.
