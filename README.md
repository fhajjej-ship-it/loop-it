<p align="center">
  <img src="skills/loop-it/assets/loop-it-logo-black.svg" alt="Loop it" width="120" />
</p>

# Loop it

[![Release](https://img.shields.io/github/v/release/fhajjej-ship-it/loop-it?label=release)](https://github.com/fhajjej-ship-it/loop-it/releases)
[![Check](https://github.com/fhajjej-ship-it/loop-it/actions/workflows/check.yml/badge.svg)](https://github.com/fhajjej-ship-it/loop-it/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-111111.svg)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-111111.svg)](package.json)
[![npm package](https://img.shields.io/badge/npm-%40fhajjej%2Floop--it-111111.svg)](https://www.npmjs.com/package/@fhajjej/loop-it)

Loop it is a portable loop router, library, launcher, and Agent Skill for turning coding goals into verifier-gated loops for Codex, Claude Code, Cursor, and other tools that understand `SKILL.md`.

It turns a vague instruction like "improve this repo" into a bounded run: inspect the codebase, recommend the right loop, run a verifier, make the smallest credible change, track evidence, then stop when the verifier passes or the budget is spent.

Product page: https://swarmixai.com/experiments/loop-it-poc

## What Is Inside

- `skills/loop-it/SKILL.md`: the canonical portable skill.
- `bin/loop-it.mjs`: installer, loop router, loop writer, loop launcher, and loop-file helper.
- `skills/loop-it/references/library/loops.json`: bundled loop library.
- `skills/loop-it/scripts/select-loop.mjs`: zero-dependency loop selector and recommender.
- `skills/loop-it/scripts/run-loop.mjs`: repo-intake router that recommends a loop and prepares a run-mode prompt.
- `skills/loop-it/scripts/start-loop.mjs`: zero-dependency goal/verifier launcher.
- `skills/loop-it/references/loop-template.md`: durable loop state template.
- `skills/loop-it/scripts/create-loop.mjs`: zero-dependency loop contract generator.
- `.codex-plugin/plugin.json`: Codex plugin metadata.
- `.claude-plugin/plugin.json`: Claude Code plugin metadata.
- `.cursor-plugin/plugin.json`: Cursor plugin metadata.
- `tests/smoke-install.mjs`: installer and packed-package smoke test.

## Quickstart

Run the install command from the project where you want Loop it available:

Current public install:

```bash
npx @fhajjej/loop-it@latest install --agent all --scope project
```

If you are following an example that says `cd /path/to/your-project`, replace that placeholder with a real project folder on your machine. You can also stay anywhere and pass the project explicitly:

```bash
npx @fhajjej/loop-it@latest install --agent all --scope project --cwd /real/path/to/your-project
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
npx @fhajjej/loop-it@latest install --agent all --scope global
```

See [docs/install.md](docs/install.md) for host paths, global install notes, and verification steps.

## Find, Recommend, Run

Loop it has three product verbs:

1. **Find** the relevant repo signals: package scripts, CI config, active loop state, and the user's goal.
2. **Recommend** one bundled loop with a verifier gate.
3. **Run** the selected loop in Codex, Claude Code, or Cursor until proof, blocker, or approval.

`loop-it run --execute codex` is the happy path when the user wants work done. `loop-it run` without `--execute` prepares the same loop contract and launch prompt without calling Codex. `write` and `start` are lower-level preparation commands. A result that only creates or edits `.loop-it` files is not a successful repair.

Inspect the repo, choose the loop, run Codex, and rerun the verifier:

```bash
npx @fhajjej/loop-it@latest run \
  --goal "Fix failing checkout tests" \
  --check "npm test -- checkout" \
  --agent codex \
  --execute codex
```

Omit `--execute codex` when you only want to prepare `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md`.

Write a custom loop:

```bash
npx @fhajjej/loop-it@latest write \
  --goal "Fix failing checkout tests" \
  --check "npm test -- checkout" \
  --max-iterations 5
```

Choose from the library:

```bash
npx @fhajjej/loop-it@latest recommend --goal "fix failing CI"
npx @fhajjej/loop-it@latest write --from failing-ci-repair --goal "Fix failing CI" --check "npm run check"
```

## Start A Loop

For finish-line work, start with the verifier gate. `start` writes `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md`, then prints the host-specific launch prompt. The `.loop-it` files are the map; they do not fix code by themselves, and `.loop-it`-only changes do not count as progress.

```bash
npx @fhajjej/loop-it@latest start \
  --goal "Fix failing checkout tests" \
  --check "npm test -- checkout" \
  --max-iterations 5 \
  --agent codex
```

Use `--agent claude` for Claude Code, `--agent cursor` for Cursor, or `--agent all` to generate every host prompt.

## Four-Step Workflow

Loop it is meant to answer five questions in order:

1. What does the user want changed?
2. What repo signals tell us which loop fits?
3. What verifier rejects bad output?
4. Does a library loop already fit?
5. Which host should run the loop?

```bash
npx @fhajjej/loop-it@latest run --goal "fix failing checkout test" --check "npm test -- checkout" --agent codex
npx @fhajjej/loop-it@latest start --goal "fix failing checkout test" --check "npm test -- checkout" --agent all
npx @fhajjej/loop-it@latest next --cwd .
```

`next` continues an active loop when progress is still open. When progress is complete, stopped, or blocked, it uses the recorded evidence to recommend the next loop.

## First Loop

Codex example:

```bash
npx @fhajjej/loop-it@latest start \
  --goal "Fix the failing checkout test without unrelated refactors" \
  --check "npm test -- checkout" \
  --max-iterations 3 \
  --agent codex
```

Paste the generated Codex launch prompt as a normal message. That is the step that asks Codex to inspect, edit, verify, and report. If `$loop-it` or slash commands are unavailable, the generated prompt still tells the agent to run the bounded task directly.

More examples: [docs/examples.md](docs/examples.md).

## Loop Library

The library is still useful, but it is no longer the product center. Use it to pick a proven loop shape, then launch with a concrete goal and verifier.

```bash
npx @fhajjej/loop-it@latest library list
npx @fhajjej/loop-it@latest library search "failing ci"
npx @fhajjej/loop-it@latest library eval
npx @fhajjej/loop-it@latest recommend --goal "fix failing checkout test"
npx @fhajjej/loop-it@latest next --cwd .
```

Create a loop from the bundled library:

```bash
npx @fhajjej/loop-it@latest new --from failing-ci-repair
npx @fhajjej/loop-it@latest start --from failing-ci-repair --goal "Fix failing CI" --check "npm run check"
```

Library-backed loops create `.loop-it/LOOP.md` and `.loop-it/progress.json` so the agent can decide whether to continue the current loop or recommend the next one.

The bundled catalog currently includes 20 local-first loops:

| Loop | Category | Best for |
| --- | --- | --- |
| `ticket-to-verified-fix` | engineering | Turn a bug report or small defect into the smallest patch with proof. |
| `failing-ci-repair` | engineering | Repair a failing build, lint, type-check, or test job with the smallest verified change. |
| `flaky-test-stabilization` | engineering | Stabilize an intermittent test or check by isolating nondeterminism and proving repeated passes. |
| `regression-bisect` | engineering | Find the change that introduced a regression, patch the cause, and verify against known good and bad behavior. |
| `deployment-preview-repair` | operations | Repair a failed preview, deployment, or hosted build using deploy logs and local reproduction where possible. |
| `runtime-error-triage` | engineering | Diagnose a runtime crash or console/log error, patch the failing path, and prove the error no longer appears. |
| `api-contract-drift` | engineering | Realign frontend, backend, schema, or client expectations when an API contract has drifted. |
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
| `skill-instruction-hardening` | operations | Improve Agent Skill routing, examples, and verifier behavior. |
| `codebase-intake-to-running-loop` | operations | Inspect a repo request, choose the right loop, and run one bounded verifier-gated loop. |

## Good Loop Contract

Every useful loop needs:

- Objective: the concrete outcome, not a theme.
- Scope: repository, files, feature area, data source, or environment.
- Verifier gate: command, benchmark, manual inspection, review criterion, or measurable threshold that can reject bad output.
- Iteration cap: maximum passes or time budget.
- Stop conditions: success, repeated failure, blocked access, unsafe action, or approval requirement.
- Evidence: changed files, verification output, residual risk, and the next decision.
- Approval gates: production writes, external messages, payments, destructive git operations, credentials, deploys, or irreversible data changes.

Create a durable loop file:

```bash
npx @fhajjej/loop-it@latest new \
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
node ./bin/loop-it.mjs run --goal "Inspect this repo and run the right loop" --agent codex
node ./bin/loop-it.mjs write --goal "Fix failing CI" --check "npm run check"
node ./bin/loop-it.mjs start --goal "Fix failing CI" --check "npm run check" --agent all
node ./bin/loop-it.mjs library search "release readiness"
node ./bin/loop-it.mjs library eval
node ./bin/loop-it.mjs recommend --goal "fix failing CI"
node ./bin/loop-it.mjs new --name "Release readiness" --objective "Prepare public release" --check "npm run check"
```

`npm run check` verifies CLI syntax, selector syntax, skill generator syntax, loop runner syntax, loop launcher syntax, plugin metadata JSON, Codex/Claude/Cursor installs, library selection evals, loop-file creation, loop launch creation, packed-tarball execution, and package contents.

## Release Status

Loop it is published as the scoped npm package `@fhajjej/loop-it`.

```bash
npx @fhajjej/loop-it@latest install --agent all --scope project
```

## Version Boundaries

Loop it deliberately avoids hosted accounts, ratings, background scheduling, production automation, multi-agent orchestration, billing, dashboards, and external-message sending. It compiles and launches local verifier-gated loops; host tools provide the actual heartbeat when they support one.

## License

MIT License. See [LICENSE](LICENSE).
