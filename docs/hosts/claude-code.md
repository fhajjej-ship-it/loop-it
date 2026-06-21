# Claude Code

Install Loop it into a project:

```bash
node ./bin/loop-it.mjs install --agent claude --scope project
```

This creates:

```text
.claude/skills/loop-it/SKILL.md
```

Invoke it in Claude Code:

```text
/loop-it create a docs sweep loop for this repository
```

Goal behavior:

- Claude Code does not have Codex Goals.
- Loop it creates portable `.loop-it/LOOP.md` and `.loop-it/progress.json` files when durable state is useful.
- Use those files as the shared loop contract across Claude Code, Codex, Cursor, and other `SKILL.md`-compatible agents.

Recommended Claude Code use:

- terminal-first repair loops;
- explicit verification checkpoints;
- readable iteration notes;
- small changes that can be reviewed between passes.
