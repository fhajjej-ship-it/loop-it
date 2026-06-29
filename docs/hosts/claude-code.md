# Claude Code

Install Loop it into a project:

```bash
npx @fhajjej/loop-it@latest install --agent claude --scope project
```

This creates:

```text
.claude/skills/loop-it/SKILL.md
```

Run the command from the project root, or pass `--cwd /real/path/to/your-project`.

Invoke it in Claude Code:

```text
/loop-it create a docs sweep loop for this repository
```

Generate a Claude Code launch prompt:

```bash
npx @fhajjej/loop-it@latest start \
  --goal "Fix failing checkout tests" \
  --check "npm test -- checkout" \
  --agent claude
```

Claude Code launch behavior:

- For finish-line work, Loop it generates a `/goal` prompt with the goal, verifier, iteration cap, stop conditions, and approval gates.
- It also creates portable `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md` files.
- Use Claude Code `/loop` for polling or interval work. Use `/goal` when the task has a verifier and a finish line.

Recommended Claude Code use:

- terminal-first repair loops;
- explicit verification checkpoints;
- readable iteration notes;
- small changes that can be reviewed between passes.
