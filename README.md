<p align="center">
  <img src="skills/loop-it/assets/loop-it-logo-black.svg" alt="Loop it" width="120" />
</p>

# Loop it

[![Release](https://img.shields.io/github/v/release/fhajjej-ship-it/loop-it?label=release)](https://github.com/fhajjej-ship-it/loop-it/releases)
[![Check](https://github.com/fhajjej-ship-it/loop-it/actions/workflows/check.yml/badge.svg)](https://github.com/fhajjej-ship-it/loop-it/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-111111.svg)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-111111.svg)](package.json)
[![npm package](https://img.shields.io/badge/npm-%40fhajjej%2Floop--it-111111.svg)](https://www.npmjs.com/package/@fhajjej/loop-it)

Loop it is a portable loop library and Agent Skill for finding, recommending, and running bounded coding loops in Codex, Claude Code, Cursor, and other tools that understand `SKILL.md`.

It turns a vague instruction like "keep fixing it" into a clear loop: find the right loop, choose the agent, define proof, set a pass limit, track progress, then stop when the loop is done or no longer useful.

Product page: https://swarmixai.com/experiments/loop-it-poc

## What Is Inside

- `skills/loop-it/SKILL.md`: the canonical portable skill.
- `bin/loop-it.mjs`: installer and loop-file helper.
- `skills/loop-it/references/library/loops.json`: bundled loop library.
- `skills/loop-it/scripts/select-loop.mjs`: zero-dependency loop selector and recommender.
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

## Four-Step Workflow

Loop it is meant to answer four questions in order:

1. Choose the right loop from the library.
2. Create and run the bounded loop in Codex, Claude Code, or Cursor.
3. Track evidence in `.loop-it/progress.json`.
4. Ask what should be looped next.

```bash
npx @fhajjej/loop-it@latest recommend --goal "fix failing checkout test"
npx @fhajjej/loop-it@latest new --from failing-ci-repair
npx @fhajjej/loop-it@latest next --cwd .
```

`next` continues an active loop when progress is still open. When progress is complete, stopped, or blocked, it uses the recorded evidence to recommend the next loop.

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

## Loop Library

Find the right loop before writing the prompt:

```bash
node ./bin/loop-it.mjs library list
node ./bin/loop-it.mjs library search "failing ci"
node ./bin/loop-it.mjs recommend --goal "fix failing checkout test"
node ./bin/loop-it.mjs next --cwd .
```

Create a loop from the bundled library:

```bash
node ./bin/loop-it.mjs new --from failing-ci-repair
```

Library-backed loops create `.loop-it/LOOP.md` and `.loop-it/progress.json` so the agent can decide whether to continue the current loop or recommend the next one.

The bundled catalog currently includes 13 local-first loops:

| Loop | Category | Best for |
| --- | --- | --- |
| `ticket-to-verified-fix` | engineering | Turn a bug report or small defect into the smallest patch with proof. |
| `failing-ci-repair` | engineering | Repair a failing build, lint, type-check, or test job with the smallest verified change. |
| `docs-sweep` | content | Find and fix stale setup, API, command, or workflow documentation. |
| `review-repair` | operations | Address blocking review findings until the diff is ready to ship. |
| `release-readiness` | operations | Prepare a package, app, or feature for a public release with evidence. |
| `fresh-setup` | engineering | Validate a clean checkout or clean project setup and repair hidden assumptions. |
| `test-coverage-gap` | evaluation | Add focused tests around risky behavior without broad test churn. |
| `ux-polish` | product | Improve a specific user flow for clarity, responsiveness, and accessibility. |
| `performance-measurement` | engineering | Improve speed, memory, bundle size, or latency using before-and-after evidence. |
| `dependency-upgrade` | engineering | Upgrade one dependency or toolchain surface with compatibility proof. |
| `security-hardening` | security | Reduce a concrete security risk with scoped evidence and approval gates. |
| `refactor-containment` | engineering | Refactor a narrow area while proving behavior stays the same. |
| `product-evaluation` | evaluation | Run realistic scenarios, repair misses, and prove the flow meets a quality bar. |

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

This creates `.loop-it/LOOP.md` and `.loop-it/progress.json` in the current directory.

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
node ./bin/loop-it.mjs library search "release readiness"
node ./bin/loop-it.mjs recommend --goal "fix failing CI"
node ./bin/loop-it.mjs new --name "Release readiness" --objective "Prepare public release" --check "npm run check"
```

`npm run check` verifies CLI syntax, selector syntax, skill generator syntax, plugin metadata JSON, Codex/Claude/Cursor installs, library selection, loop-file creation, packed-tarball execution, and package contents.

## Release Status

Loop it is published as the scoped npm package `@fhajjej/loop-it`.

```bash
npx @fhajjej/loop-it@latest install --agent all --scope project
```

## Version 1 Boundaries

Loop it deliberately avoids hosted accounts, ratings, scheduling, production automation, multi-agent orchestration, billing, dashboards, and external-message sending. Those should come after the local loop library proves the workflow is worth automating.

## License

MIT License. See [LICENSE](LICENSE).
