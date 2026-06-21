# Codex

Install Loop it into a project:

```bash
node ./bin/loop-it.mjs install --agent codex --scope project
```

This creates:

```text
.agents/skills/loop-it/SKILL.md
```

Invoke it in Codex:

```text
Use $loop-it to create a bounded repair loop for this bug.
```

Codex Goal behavior:

- If this Codex environment exposes a native goal/task capability, Loop it can use it when you explicitly ask to set a Codex goal.
- If no native goal capability is available, Loop it creates portable `.loop-it/LOOP.md` and `.loop-it/progress.json` files instead.
- Portable loop files are not the same thing as a native Codex Goal; they are durable project state that any supported agent can read.

Recommended Codex use:

- repo-grounded bug fixes;
- PR hardening;
- docs sweeps;
- release-readiness loops;
- one bounded verification pass at a time.
