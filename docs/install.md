# Local development installation

End users should install Loop It from the Codex plugin interface or open a self-contained prompt from the [product page](https://swarmixai.com/experiments/loop-it). This document is for maintainers who need a project-local development copy of the portable skill.

## Package install

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

## Verify the development copy

Check that `SKILL.md`, the goal catalog, the advanced loop catalog, and their scripts exist in each selected host path. Run the repository's package check before sharing a local copy; it validates fresh installs, both routing evaluation sets, prompt-only guards, repository run proof, readiness behavior, and package contents.

Generated launches must be normal-language messages. They may tell the agent to run a configured project check internally, but they must not expose that terminal command to the user. Creating `.loop-it` files only prepares advanced repository state; the task is complete only when the requested artifact or repository result has real proof.

The package still contains maintainer-only CLI entry points for install, smoke tests, and non-interactive repository fixtures. They are implementation mechanics, not the public product workflow.
