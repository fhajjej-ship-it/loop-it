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

Recommended Claude Code use:

- terminal-first repair loops;
- explicit verification checkpoints;
- readable iteration notes;
- small changes that can be reviewed between passes.
