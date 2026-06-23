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

## Verify install

Check that `SKILL.md` exists in the selected host path, then ask your agent to use Loop it:

```text
Use $loop-it to create a bounded docs sweep loop for this repository.
```

You can also verify the local library selector:

```bash
npx @fhajjej/loop-it@latest library list
npx @fhajjej/loop-it@latest recommend --goal "fix failing CI"
```
