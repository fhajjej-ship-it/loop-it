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

Loop It's executable runner is intentionally centered on **goal-based coding loops**: local, bounded runs where the goal, verifier, iteration cap, stop rule, and evidence are known up front. The library also includes turn-based, time-based, and proactive loop patterns. Time-based and proactive loops can run through Loop It's Codex-only `schedule`/`tick` path. Add `--heartbeat codex` to create or update the local Codex Scheduled task that calls `tick`; Loop It still does not host a cloud background service, but it can create local connector-backed schedules for approved sources such as GitHub PRs.

It turns a vague instruction like "improve this repo" into a bounded run: inspect the codebase, recommend the right loop, run a verifier, make the smallest credible change, track evidence, then stop when the verifier passes or the budget is spent.

Product page: https://swarmixai.com/experiments/loop-it-poc

## What Is Inside

- `skills/loop-it/SKILL.md`: the canonical portable skill.
- `bin/loop-it.mjs`: installer, loop router, loop writer, loop launcher, and loop-file helper.
- `skills/loop-it/references/library/loops.json`: bundled loop library.
- `skills/loop-it/scripts/select-loop.mjs`: zero-dependency loop selector and recommender.
- `skills/loop-it/scripts/run-loop.mjs`: repo-intake router that recommends a loop and prepares a run-mode prompt.
- `skills/loop-it/scripts/schedule-loop.mjs`: file-based schedule registry, Codex Scheduled heartbeat writer, and due-tick runner for Codex-only time-based and proactive loops.
- `skills/loop-it/scripts/github-connector.mjs`: read-only GitHub PR intake through `gh` that chooses a PR/CI/review loop and creates a local schedule.
- `skills/loop-it/scripts/doctor.mjs`: local package, plugin, schedule, heartbeat, Codex CLI, and GitHub connector diagnostics.
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

`loop-it run --execute codex` is the happy path when the user wants work done. It inspects repo signals, picks or applies a loop, writes the run contract, calls Codex CLI, reruns the verifier after each pass, and repeats up to the iteration cap until proof, a repeated failure, a blocker, or approval-sensitive work stops it. When `codex` is not on the terminal `PATH`, Loop It automatically discovers the executable bundled with Codex Desktop on macOS. Use `--codex-bin <path>` or `LOOP_IT_CODEX_BIN` only when you need an explicit override. `loop-it run` without `--execute` prepares the same loop contract and launch prompt without calling Codex. `write` and `start` are lower-level preparation commands. A result that only creates or edits `.loop-it` files is not a successful repair.

Add `--checker codex` when the run needs a second, read-only review after the verifier passes. The checker inspects the changed files, verifier output, Codex output, and `.loop-it/progress.json`, then writes a checker receipt. Loop it records whether the checker passed, blocked, was inconclusive, or was skipped.

Add `--worktree` when the run should happen away from the current checkout. Loop it creates a fresh git worktree and branch from `origin/main`, `main`, `origin/master`, `master`, or `HEAD`, then runs Codex there and records the worktree path, branch, and base ref in `.loop-it/progress.json`. Use `--worktree-base`, `--worktree-branch`, or `--worktree-dir` when you need exact control.

Use `loop-it schedule` for time-based or proactive loops that should be checked again later. A schedule writes `.loop-it/schedules/<id>.json`; `loop-it tick --all --execute codex` runs due records once. Add `--heartbeat codex` to create or update a native Codex Scheduled task under `~/.codex/automations/` that calls `npx @fhajjej/loop-it@latest tick --all --execute codex`. Without `--heartbeat codex`, the heartbeat stays external: use cron, launchd, GitHub Actions, or another approved scheduler to call `tick`. Loop It records locks, run counts, the next run time, heartbeat metadata, and schedule proof in `.loop-it/progress.json`.

Use `loop-it schedules list` to see local schedules and whether the Codex heartbeat file exists. Use `loop-it schedules pause --id <id>` and `loop-it schedules resume --id <id>` to stop or restart a local schedule without deleting its evidence.

Use `loop-it github pr` when the trigger should come from GitHub. It reads a PR through the GitHub CLI, chooses `review-comment-resolver-routine`, `ci-health-watch`, or `pr-review-watch`, writes a read-only connector snapshot under `.loop-it/connectors/github/`, and creates a local schedule. It never comments, pushes, requests review, merges, deploys, or changes GitHub state without explicit approval.

Use `loop-it doctor` when the user needs to know whether Loop It is actually ready. It reports the local package version, npm latest version, personal Codex plugin cache version, project skill install, Codex CLI availability (including the Codex Desktop fallback), schedule records, Codex heartbeat files, and GitHub CLI auth when connector state exists. It exits non-zero for real blockers such as missing Codex CLI, missing configured heartbeat files, or missing GitHub auth for GitHub-backed schedules.

Before `--execute codex` starts, Loop it runs a readiness preflight:

- The goal must be concrete enough to run.
- The verifier must be an automated command, not only manual review.
- The iteration cap must be present.
- The goal and check must not require approval-sensitive work such as production deploys, npm publishing, external messages, payments, credential changes, destructive git operations, or irreversible data changes.

If the preflight fails, Loop it does not start Codex. It prints the missing verifier, approval risk, or next action instead of silently creating loop files and pretending work happened.

## Loop Type

Loop It uses the common loop taxonomy so users know what kind of automation they are starting:

| Type | Trigger | Stop rule | Loop It support |
| --- | --- | --- | --- |
| `turn-based` | User prompt | Agent answers, verifies once, or asks for context | Supported as one-turn launch prompts and skill instructions. |
| `goal-based` | User prompt with verifier | Goal passes, blocker appears, or cap is reached | Primary Loop It path: `loop-it run --execute codex`. |
| `time-based` | Interval or schedule | User cancels, external work completes, or the pass budget ends | Codex-only `schedule`/`tick` runner for file-based schedules; `--heartbeat codex` can create the local Codex Scheduled heartbeat that calls `tick`. |
| `proactive` | Event or schedule without human in real time | Each routed task exits on proof, route, or blocker | Codex-only `schedule`/`tick` runner when a connector or queue produces a safe command/check; `--heartbeat codex` covers the Codex schedule, while external event sources stay outside Loop It. |

The bundled library has 20 patterns: 5 `turn-based`, 5 `goal-based`, 5 `time-based`, and 5 `proactive`. Goal-based loops run immediately through `loop-it run --execute codex`. Time-based and proactive loops run through `loop-it schedule` plus a heartbeat that calls `tick`; in Codex, `--heartbeat codex` creates the local native Scheduled task for that heartbeat. Loop It does not poll or listen in the background by itself.

Inspect the repo, choose the loop, run Codex, and keep verifying until a stop condition is reached:

```bash
npx @fhajjej/loop-it@latest run \
  --goal "Fix failing checkout tests" \
  --check "npm test -- checkout" \
  --agent codex \
  --execute codex \
  --checker codex \
  --worktree
```

Omit `--execute codex` when you only want to prepare `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md`.

On a successful execution, the runner prints a `Run proof` summary and stores a machine-readable `proof` object with the selected loop, executor, verifier, checker result, final Codex output file, changed files, worktree metadata when isolation was used, and per-iteration evidence. If no checker is requested, the proof says the checker was skipped.

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

Schedule a time-based or proactive loop for Codex:

```bash
npx @fhajjej/loop-it@latest schedule \
  --from ci-health-watch \
  --every 10m \
  --goal "Watch CI and repair the failing check when it breaks" \
  --check "npm run check" \
  --execute codex \
  --heartbeat codex

npx @fhajjej/loop-it@latest tick --all --execute codex
```

`schedule` only accepts `time-based` and `proactive` library loops. With `--heartbeat codex`, it also creates or updates the local Codex Scheduled automation that calls `tick` on the chosen interval. `tick` first runs the check; if it already passes, it records proof and waits for the next interval. If the check fails, it runs the selected loop through Codex, reruns the verifier, updates the schedule record, and records proof.

List, pause, or resume schedules:

```bash
npx @fhajjej/loop-it@latest schedules list
npx @fhajjej/loop-it@latest schedules pause --id ci-health-watch
npx @fhajjej/loop-it@latest schedules resume --id ci-health-watch
npx @fhajjej/loop-it@latest doctor
```

Create a GitHub PR-backed schedule:

```bash
npx @fhajjej/loop-it@latest github pr \
  --repo owner/repo \
  --pr 123 \
  --every 10m \
  --execute codex \
  --heartbeat codex
```

The GitHub connector is local and read-only. It requires `gh` auth, writes `.loop-it/connectors/github/<id>.json`, and sets the scheduled verifier from the PR signal. For review changes it checks `reviewDecision`; for CI follow-up it uses `gh pr checks --fail-fast`.

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

`next` continues an active bundled loop when progress is still open. For scheduled progress with a recorded next action, it preserves that action instead of inventing a new loop, including after a passing tick records `completed`. When unscheduled progress is complete, stopped, or blocked, it uses the recorded evidence to recommend the next loop.

## First Loop

Codex example:

```bash
npx @fhajjej/loop-it@latest start \
  --goal "Fix the failing checkout test without unrelated refactors" \
  --check "npm test -- checkout" \
  --max-iterations 3 \
  --agent codex
```

For interactive Codex work, paste the generated native `/goal` command. Native Goal state owns the live lifecycle while `.loop-it` keeps the portable contract and evidence. If `/goal` or `$loop-it` is unavailable, use the generated normal-message fallback. Non-interactive `run --execute codex` continues to use Loop It's bounded runner without requiring native Goals.

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

The bundled catalog currently includes 20 loops, balanced across the four loop types:

| Loop | Type | Category | Best for |
| --- | --- | --- | --- |
| `code-path-explanation` | turn-based | engineering | Answer one codebase question with file evidence and no repo edits by default. |
| `small-edit-verification` | turn-based | engineering | Make one scoped edit, run the narrow proof, and stop. |
| `diff-review-pass` | turn-based | operations | Review the current diff for regressions, missing tests, and release blockers. |
| `error-explanation-debug` | turn-based | engineering | Interpret one error, stack trace, or log and choose the smallest next debugging action. |
| `ui-copy-clarity-pass` | turn-based | product | Improve focused UI wording or action clarity without expanding scope. |
| `codebase-intake-to-running-loop` | goal-based | operations | Inspect a repo request, choose the right loop, and run one bounded verifier-gated loop. |
| `failing-ci-repair` | goal-based | engineering | Repair a failing build, lint, type-check, or test job with the smallest verified change. |
| `ticket-to-verified-fix` | goal-based | engineering | Turn a bug report or small defect into the smallest patch with proof. |
| `security-hardening` | goal-based | security | Reduce a concrete security risk with scoped evidence and approval gates. |
| `release-readiness` | goal-based | operations | Prepare a package, app, or feature for a public release with evidence. |
| `pr-review-watch` | time-based | operations | Poll a PR for new review comments and handle actionable feedback. |
| `ci-health-watch` | time-based | operations | Poll CI until the branch is green, stable-failing, or blocked. |
| `daily-dependency-watch` | time-based | operations | Run scheduled dependency and advisory checks, then route follow-up work. |
| `docs-freshness-watch` | time-based | content | Periodically check setup docs, commands, and examples for drift. |
| `production-smoke-watch` | time-based | operations | Run scheduled public smoke checks and route failures without production writes. |
| `incoming-bug-triage-routine` | proactive | operations | Classify incoming bug reports and route one actionable item. |
| `dependency-upgrade-queue-routine` | proactive | operations | Process dependency update items as they appear with compatibility proof. |
| `review-comment-resolver-routine` | proactive | operations | React to new review comments, apply safe fixes, verify, and request re-review. |
| `customer-feedback-action-routine` | proactive | product | Classify customer feedback and route fixes or tickets without sending external replies by default. |
| `weekly-code-health-routine` | proactive | engineering | Find one small recurring code-health improvement and prove it. |

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
npm run smoke:readiness
npm run smoke:public-codex -- --keep
npm publish --dry-run --access public
node ./bin/loop-it.mjs install --agent all --scope project
node ./bin/loop-it.mjs run --goal "Inspect this repo and run the right loop" --agent codex
node ./bin/loop-it.mjs write --goal "Fix failing CI" --check "npm run check"
node ./bin/loop-it.mjs start --goal "Fix failing CI" --check "npm run check" --agent all
node ./bin/loop-it.mjs library search "release readiness"
node ./bin/loop-it.mjs library eval
node ./bin/loop-it.mjs recommend --goal "fix failing CI"
node ./bin/loop-it.mjs new --name "Release readiness" --objective "Prepare public release" --check "npm run check"
node ./bin/loop-it.mjs schedule --from ci-health-watch --every 10m --check "npm run check" --execute codex --heartbeat codex
node ./bin/loop-it.mjs schedules list
node ./bin/loop-it.mjs github pr --repo owner/repo --pr 123 --every 10m --execute codex --heartbeat codex
node ./bin/loop-it.mjs doctor
node ./bin/loop-it.mjs tick --all --execute codex
```

`npm run check` verifies CLI syntax, selector syntax, skill generator syntax, loop runner syntax, loop launcher syntax, plugin metadata JSON, Codex/Claude/Cursor installs, library selection evals, loop-file creation, loop launch creation, packed-tarball execution, and package contents.

`npm run smoke:run-proof` is the narrow execution proof: it starts from a failing temporary repo, selects `failing-ci-repair`, runs a fake Codex executor twice, reruns `npm test` after each pass, exercises checker pass/block behavior, proves isolated worktree execution leaves the source checkout untouched, and checks that `.loop-it/progress.json` records completed proof.

`npm run smoke:readiness` proves the runner refuses unattended Codex execution when there is no automated verifier or when the request requires approval-sensitive work.

`npm run smoke` includes the scheduled-runner proof: it rejects goal-based loops for scheduling, creates a time-based Codex schedule, writes the Codex Scheduled heartbeat file, lists/pause/resumes schedules, ticks a due record through a fake Codex executable, verifies the failing check is fixed, annotates `.loop-it/progress.json`, skips locked schedules, proves doctor diagnostics for ready and missing-heartbeat states, and proves a fake GitHub PR can create a connector-backed scheduled loop.

`npm run smoke:public-codex -- --keep` is the public-package execution proof. It installs `@fhajjej/loop-it@latest` into a fresh temporary repo, runs the public `loop-it run --execute codex` path against a tiny failing `npm test`, reruns the verifier, and checks `.loop-it/progress.json` for completed proof. It requires local Codex CLI auth and may use a real Codex request, so it is kept out of `npm run check`.

## Release Status

Loop it is published as the scoped npm package `@fhajjej/loop-it`.

```bash
npx @fhajjej/loop-it@latest install --agent all --scope project
```

## Version Boundaries

Loop it deliberately avoids hosted accounts, ratings, hosted background services, production automation, broad multi-agent orchestration, billing, dashboards, and external-message sending. It runs local goal-based verifier-gated loops immediately. It can also run time-based and proactive loops through Codex-only `schedule`/`tick` files. In Codex, `--heartbeat codex` can create the local native Scheduled task that calls `tick`; outside Codex, an approved external heartbeat or connector must call `tick`. The built-in GitHub connector is read-only and local. Loop It does not own external side effects.

## License

MIT License. See [LICENSE](LICENSE).
