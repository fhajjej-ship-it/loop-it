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

Recommended Codex use:

- repo-grounded bug fixes;
- PR hardening;
- docs sweeps;
- release-readiness loops;
- one bounded verification pass at a time.
