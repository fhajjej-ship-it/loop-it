<p align="center">
  <img src="skills/loop-it/assets/loop-it-logo-black.svg" alt="Loop it" width="120" />
</p>

# Loop it

[![Release](https://img.shields.io/github/v/release/fhajjej-ship-it/loop-it?label=release)](https://github.com/fhajjej-ship-it/loop-it/releases)
[![Check](https://github.com/fhajjej-ship-it/loop-it/actions/workflows/check.yml/badge.svg)](https://github.com/fhajjej-ship-it/loop-it/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-111111.svg)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-111111.svg)](package.json)
[![npm package](https://img.shields.io/badge/npm-%40fhajjej%2Floop--it-111111.svg)](https://www.npmjs.com/package/@fhajjej/loop-it)

Loop it is a portable Agent Skill for setting bounded coding loops in Codex, Claude Code, Cursor, and other tools that understand `SKILL.md`.

It turns a vague instruction like "keep fixing it" into a clear loop: choose the agent, choose the job, define proof, set a pass limit, then stop when the loop is done or no longer useful.

Product page: https://swarmixai.com/experiments/loop-it-poc

## What Is Inside

- `skills/loop-it/SKILL.md`: the canonical portable skill.
- `bin/loop-it.mjs`: installer and loop-file helper.
- `skills/loop-it/references/loop-template.md`: durable loop state template.
- `skills/loop-it/scripts/create-loop.mjs`: zero-dependency loop contract generator.
- `.codex-plugin/plugin.json`: Codex plugin metadata.
- `.claude-plugin/plugin.json`: Claude Code plugin metadata.
- `.cursor-plugin/plugin.json`: Cursor plugin metadata.
- `tests/smoke-install.mjs`: installer and packed-package smoke test.

## Quickstart

Current public install:

```bash
npx @fhajjej/loop-it@latest install --agent all --scope project
```

GitHub install:

```bash
git clone https://github.com/fhajjej-ship-it/loop-it.git
cd loop-it
node ./bin/loop-it.mjs install --agent all --scope project
```

That copies the skill into:

| Agent | Install path | Invoke with |
| --- | --- | --- |
| Codex | `.agents/skills/loop-it/` | `Use $loop-it` |
| Claude Code | `.claude/skills/loop-it/` | `/loop-it` |
| Cursor | `.cursor/skills/loop-it/` | `/loop-it` |

For a global install:

```bash
node ./bin/loop-it.mjs install --agent all --scope global
```

See [docs/install.md](docs/install.md) for host paths, global install notes, and verification steps.

## First Loop

Codex example:

```text
Use $loop-it to fix the failing checkout test.

Objective:
Fix the regression without unrelated refactors.

Success check:
npm test -- checkout

Iteration budget:
3 passes maximum.

Stop conditions:
Stop when the test passes with regression coverage, the same failure repeats twice, or approval is needed.
```

More examples: [docs/examples.md](docs/examples.md).

## Good Loop Contract

Every useful loop needs:

- Objective: the concrete outcome, not a theme.
- Scope: repository, files, feature area, data source, or environment.
- Success check: command, benchmark, manual inspection, review criterion, or measurable threshold.
- Iteration cap: maximum passes or time budget.
- Stop conditions: success, repeated failure, blocked access, unsafe action, or approval requirement.
- Evidence: changed files, verification output, residual risk, and the next decision.
- Approval gates: production writes, external messages, payments, destructive git operations, credentials, deploys, or irreversible data changes.

Create a durable loop file:

```bash
node ./bin/loop-it.mjs new \
  --name "Docs sweep" \
  --objective "Find and update stale setup documentation" \
  --check "run the documented setup commands from a clean checkout" \
  --max-iterations 3
```

This creates `.loop-it/LOOP.md` in the current directory.

## Host Notes

- [Codex](docs/hosts/codex.md)
- [Claude Code](docs/hosts/claude-code.md)
- [Cursor](docs/hosts/cursor.md)

## Review Pack

- [Reviewer FAQ](docs/reviewer-faq.md)
- [Marketplace checklist](docs/marketplace-checklist.md)
- [Release checklist](RELEASE.md)
- [Changelog](CHANGELOG.md)
- [Security policy](SECURITY.md)
- [Contributing guide](CONTRIBUTING.md)

## CLI

```bash
npm run check
npm run smoke
npm publish --dry-run --access public
node ./bin/loop-it.mjs install --agent all --scope project
node ./bin/loop-it.mjs new --name "Release readiness" --objective "Prepare public release" --check "npm run check"
```

`npm run check` verifies CLI syntax, skill generator syntax, plugin metadata JSON, Codex/Claude/Cursor installs, loop-file creation, packed-tarball execution, and package contents.

## Release Status

Loop it is published as the scoped npm package `@fhajjej/loop-it`.

```bash
npx @fhajjej/loop-it@latest install --agent all --scope project
```

## Version 1 Boundaries

Loop it deliberately avoids scheduling, production automation, multi-agent orchestration, billing, dashboards, and external-message sending. Those should come after a manual loop proves the workflow is worth automating.

## License

MIT License. See [LICENSE](LICENSE).
