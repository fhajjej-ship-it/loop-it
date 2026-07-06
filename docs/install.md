# Install

Loop it installs one portable skill into the agent host directory you choose.

## Current public install

Run this from the project where you want the agent skill installed:

```bash
npx @fhajjej/loop-it@latest install --agent all --scope project
```

If an example says `cd /path/to/your-project`, replace that placeholder with a real folder. To install into a project without changing directories:

```bash
npx @fhajjej/loop-it@latest install --agent all --scope project --cwd /real/path/to/your-project
```

## GitHub install

```bash
git clone https://github.com/fhajjej-ship-it/loop-it.git
cd loop-it
node ./bin/loop-it.mjs install --agent all --scope project
```

## Project install paths

| Agent | Path |
| --- | --- |
| Codex | `.agents/skills/loop-it/` |
| Claude Code | `.claude/skills/loop-it/` |
| Cursor | `.cursor/skills/loop-it/` |

## Global install

```bash
npx @fhajjej/loop-it@latest install --agent all --scope global
```

Use `--force` to replace an existing install after reviewing what will be overwritten.

## Update an existing install

Treat `skills/loop-it/` as the source of truth. After changing the skill source in this repository, refresh all local project host installs:

```bash
npm run sync:project
```

For a different project, run:

```bash
npx @fhajjej/loop-it@latest install --agent all --scope project --cwd /real/path/to/your-project --force
```

`npm run check` verifies that fresh Codex, Claude Code, and Cursor installs exactly match the canonical skill source.

## Verify install

Check that `SKILL.md` exists in the selected host path, then compile a verifier-gated loop:

```bash
npx @fhajjej/loop-it@latest run --goal "Inspect this repo and run the right loop" --agent codex
npx @fhajjej/loop-it@latest write --goal "Fix failing CI" --check "npm run check"
npx @fhajjej/loop-it@latest start --goal "Fix failing CI" --check "npm run check" --agent all
```

Paste the relevant prompt from `.loop-it/LAUNCH.md` into Codex, Claude Code, or Cursor. Creating `.loop-it` files only prepares the loop; the pasted prompt is what asks the agent to repair and verify. If the agent only changes `.loop-it`, keep going because the issue has not been fixed.

For Codex CLI execution, use `run --execute codex` instead of only preparing a launch prompt:

```bash
npx @fhajjej/loop-it@latest run --goal "Fix failing CI" --check "npm run check" --agent codex --execute codex
```

That path calls Codex, reruns the verifier after each pass, repeats up to the iteration cap, prints a `Run proof` summary on success, and records the selected loop, executor, verifier, result, Codex output paths, changed files, and per-iteration evidence in `.loop-it/progress.json`.

You can also ask your agent to use Loop it directly:

```text
Use $loop-it to create a bounded docs sweep loop for this repository.
```

You can also verify the local library selector:

```bash
npx @fhajjej/loop-it@latest library list
npx @fhajjej/loop-it@latest library eval
npx @fhajjej/loop-it@latest recommend --goal "fix failing CI"
```
