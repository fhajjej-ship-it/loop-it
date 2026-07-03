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

- For finish-line work, Loop it generates a normal-message prompt with the goal, verifier, iteration cap, stop conditions, and approval gates.
- It also creates portable `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md` files.
- Those files are the contract, not the repair. Paste the launch prompt or ask Codex to run the loop before expecting changed files.
- If `$loop-it` or slash commands are unavailable, use the same generated prompt as plain instructions and tell Codex to run the loop now.

Recommended Codex use:

- repo-grounded bug fixes;
- PR hardening;
- docs sweeps;
- release-readiness loops;
- one bounded verification pass at a time.
