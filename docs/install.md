# Install

Loop it installs one portable skill into the agent host directory you choose.

## Current public install

```bash
npx @fhajjej/loop-it@latest install --agent all --scope project
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
node ./bin/loop-it.mjs install --agent all --scope global
```

Use `--force` to replace an existing install after reviewing what will be overwritten.

## Verify install

Check that `SKILL.md` exists in the selected host path, then ask your agent to use Loop it:

```text
Use $loop-it to create a bounded docs sweep loop for this repository.
```

You can also verify the local library selector:

```bash
node ./bin/loop-it.mjs library list
node ./bin/loop-it.mjs recommend --goal "fix failing CI"
```
