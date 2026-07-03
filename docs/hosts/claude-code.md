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

- For finish-line work, Loop it generates a normal-message prompt with the goal, verifier, iteration cap, stop conditions, and approval gates.
- It also creates portable `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md` files.
- Those files are the contract, not the repair. Paste the launch prompt or ask Claude Code to run the loop before expecting changed files.
- Use Claude Code `/loop` for polling or interval work. For verifier-gated finish-line work, run the generated prompt as a bounded goal with proof.

Recommended Claude Code use:

- terminal-first repair loops;
- explicit verification checkpoints;
- readable iteration notes;
- small changes that can be reviewed between passes.
