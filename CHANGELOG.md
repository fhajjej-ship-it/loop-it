# Changelog

## Unreleased

## 0.3.16

### Added

- Added `loop-it github pr` as a read-only GitHub PR connector that uses `gh` to inspect PR review/CI signals, choose a PR/CI/review loop, write a local connector snapshot, and create a Codex schedule.
- Added `loop-it schedules list`, `loop-it schedules pause`, and `loop-it schedules resume` for local schedule lifecycle visibility.
- Added smoke coverage for GitHub connector schedule creation, heartbeat status listing, and schedule pause/resume.

### Changed

- Scheduled loops can persist a `--checker codex` setting so scheduled Codex repairs keep maker-checker proof by default when created through the GitHub connector.

## 0.3.15

### Added

- Added `loop-it schedule --heartbeat codex` to create or update a native Codex Scheduled heartbeat that calls `loop-it tick`.
- Added scheduled-runner smoke coverage for the generated Codex automation file, RRULE, status, command, and persisted schedule heartbeat metadata.

### Changed

- Updated CLI help, README, reviewer docs, marketplace checklist, and plugin copy so time-based and proactive loops explain the real Codex Scheduled path instead of only saying an external heartbeat is required.

## 0.3.14

### Added

- Added a Codex-only `loop-it schedule` and `loop-it tick` path for time-based and proactive loops.
- Added scheduled-runner smoke coverage for schedule creation, due ticks, fake Codex execution, progress proof, and lock skipping.

### Changed

- Rebalanced the bundled loop library to 20 patterns: 5 `turn-based`, 5 `goal-based`, 5 `time-based`, and 5 `proactive`.
- Updated selector evals and smoke coverage so every bundled loop type has routing proof and the library cannot drift back to all goal-based patterns unnoticed.
- Clarified README, marketplace, and skill instructions that time-based and proactive loops use the Codex-only schedule/tick path and still require an external heartbeat or connector.

## 0.3.13

### Added

- Added loop taxonomy metadata so every bundled loop declares whether it is `turn-based`, `goal-based`, `time-based`, or `proactive`.

### Changed

- Clarified docs and plugin copy that Loop It is currently a local goal-based verifier-gated runner, not a background scheduler or proactive automation platform.

## 0.3.12

### Added

- Added opt-in worktree isolation for `loop-it run --execute codex` via `--worktree`, with optional base, branch, and path controls.
- Added run-proof smoke coverage that proves isolated worktree execution leaves the source checkout untouched and records worktree metadata in `.loop-it/progress.json`.

## 0.3.11

### Added

- Added optional maker-checker proof for `loop-it run --execute codex` via `--checker codex`, including read-only checker receipts in `.loop-it/progress.json`.
- Added smoke coverage for verifier pass plus checker approval in the bounded Codex runner.

## 0.3.10

### Added

- Added `npm run smoke:public-codex` as the named public-package execution proof for `@fhajjej/loop-it@latest`.

### Changed

- Changed the optional public install Codex smoke to exercise `loop-it run --execute codex` directly and assert completed `.loop-it/progress.json` proof.

## 0.3.9

### Added

- Added a readiness preflight before unattended `loop-it run --execute codex` execution so Codex does not start when no automated verifier is available or the requested work requires approval-sensitive actions.
- Added smoke coverage for readiness blocking on manual-only verification and approval-sensitive publishing requests.

### Changed

- Documented the readiness preflight in the README and portable Loop It skill instructions.

## 0.3.8

### Changed

- Changed `loop-it run --execute codex` from one Codex pass into a bounded runner that repeats Codex execution and verifier checks until proof, repeated failure, a blocker, approval-sensitive work, or the iteration cap stops it.
- Expanded run-proof smoke coverage so the fake Codex executor must fail once, run a second pass, then prove success through `.loop-it/progress.json`.

## 0.3.7

### Added

- Added `loop-it run --execute codex` to prepare a selected loop, call Codex CLI, rerun the verifier, and update `.loop-it/progress.json` with pass, failure, or blocker evidence.
- Added smoke coverage for runner execution using a fake Codex executable so CI can verify the orchestration path without Codex auth or model calls.
- Added `npm run smoke:public-install` to verify `@fhajjej/loop-it@latest` installs from npm, writes project Codex skill files, and preserves the run-now launch fallback wording.

### Changed

- Clarified docs and CLI help so `loop-it run` without `--execute` means prepare the launch contract, while `loop-it run --execute codex` means run the selected loop locally through Codex CLI.

## 0.3.6

### Changed

- Changed generated Codex, Claude Code, and Cursor launch prompts to work as normal agent messages instead of relying on native `/goal` support.
- Clarified run-mode launch behavior so agents run the bounded task directly when `$loop-it`, `/loop-it`, or slash commands are unavailable.
- Updated smoke coverage to verify the generated launch prompts preserve the run-now guardrails.

## 0.3.5

### Added

- Added five loop-library patterns for flaky test stabilization, regression bisect, deployment preview repair, runtime error triage, and API contract drift.
- Added selector eval scenarios for the new loop patterns so every bundled loop has routing coverage.

## 0.3.4

### Changed

- Published the Codex plugin website metadata so the plugin details page links to the Loop It product page instead of showing an unavailable website.

## 0.3.3

### Added

- Added `loop-it run` to inspect repository signals, recommend the right bundled loop, infer a verifier, and prepare a run-mode launch prompt.
- Added the `codebase-intake-to-running-loop` recipe for broad requests like "inspect this repo" or "what should Loop It tackle next".
- Added selector eval scenarios and smoke coverage for broad repo-intake routing.

### Changed

- Repositioned the Codex plugin defaults around finding, recommending, and running loops instead of only writing loop contracts.
- Updated Loop It skill instructions so broad fix/improve/debug requests default to repo inspection, loop selection, verifier execution, and evidence recording.

## 0.3.2

### Added

- Added reliability metadata to every bundled loop recipe, including status, best-fit conditions, failure modes, and required proof checks.
- Added plain-language `userGuide` metadata to every bundled loop recipe so users can understand when to use a loop, how to start, and when to avoid it.
- Added shipped library evaluation scenarios covering all 14 loop recipes.
- Added smoke coverage that fails when loop reliability metadata is missing or scenario routing regresses.
- Added smoke coverage that fails when loop recipes omit beginner-facing guide fields.
- Added run-mode launch prompt guardrails so agents do not treat `.loop-it` file creation as the repair.

### Changed

- Clarified that bundled loops are starter recipes with verifier gates, not guaranteed outcomes unless future eval evidence proves them.
- Improved library selector output with plain-English guidance, starter requests, first steps, proof tips, and not-for guidance.
- Clarified generated Codex, Claude Code, and Cursor launch prompts to run the verifier first, avoid creating another loop, and keep going when only `.loop-it` files changed.

## 0.3.1

### Added

- Added `npm run sync:project` to refresh local Codex, Claude Code, and Cursor project skill installs from the canonical `skills/loop-it/` source.
- Added smoke coverage that fails when generated host installs drift from the canonical skill source or plugin manifest versions drift from `package.json`.
- Added evaluable loop metadata: required signals, good examples, counterexamples, example checks, and common misroutes.
- Added the `skill-instruction-hardening` loop for improving Agent Skills, prompt routing, and loop-library recommendation behavior.

### Changed

- Documented the source-of-truth update flow for refreshing existing host installs after skill changes.
- Ignored generated local host installs and `.loop-it` state so duplicate skill copies do not become source files.
- Improved selector output with recommendation confidence and alternative rationale.

## 0.3.0

### Added

- Added `loop-it write` as the product-facing loop authoring command for writing verifier-gated loop contracts.
- Added `loop-it start` to compile a goal, verifier gate, iteration cap, stop conditions, approval gates, durable loop state, and host-specific launch prompt.
- Added `.loop-it/LAUNCH.md` generation for Codex, Claude Code, and Cursor.
- Added smoke coverage for loop writing, launcher output, required verifier validation, and packed-tarball launcher execution.

### Changed

- Repositioned Loop it around writing loops, choosing from the loop library, and launching verifier-gated loops.
- Updated host docs to use native `/goal` launch prompts for Codex and Claude Code finish-line work, with portable state fallback where needed.

## 0.2.3

### Changed

- Clarified public npm install commands for first-time Codex, Claude Code, and Cursor setup.
- Made loop creation output list both `.loop-it/LOOP.md` and `.loop-it/progress.json` when progress tracking is enabled.

## 0.2.2

### Changed

- Documented Codex Goal behavior separately from portable `.loop-it` state, including fallback behavior when a native Codex goal tool is unavailable.
- Clarified that Claude Code and Cursor use portable loop files rather than Codex Goals.
- Aligned Codex, Claude Code, and Cursor plugin metadata versions with the package release.

## 0.2.1

### Added

- Workflow guidance in loop recommendations so users can choose, create, track, and ask for the next loop from one CLI response.
- Evidence tracking and next-loop instructions in generated `.loop-it/LOOP.md` and `progress.json` files.
- Regression smoke coverage for terminal progress states so completed or blocked loops recommend a next loop instead of continuing the old active loop.

## 0.2.0

### Added

- Bundled loop library with curated coding loops for CI repair, bug fixes, docs, review repair, release readiness, setup, testing, UX, performance, dependencies, security, refactoring, and product evaluation.
- Offline loop selector CLI for listing, searching, recommending, and choosing the next loop from `.loop-it` progress.
- `loop-it new --from <loop-id>` for generating library-backed loop contracts.
- `.loop-it/progress.json` creation for machine-readable loop progress.

## 0.1.1

### Changed

- Renamed the npm package to `@fhajjej/loop-it` to comply with npm package-name similarity checks.
- Updated public install docs to use the scoped npm package.

## 0.1.0

Initial public release candidate.

### Added

- Portable `loop-it` Agent Skill for Codex, Claude Code, Cursor, and SKILL.md-compatible agents.
- Installer CLI for project and global skill installs.
- Durable `.loop-it/LOOP.md` generator.
- Codex plugin metadata.
- Installer smoke test for Codex, Claude Code, Cursor, loop-file creation, and packed-tarball execution.
- GitHub Actions checks and manual npm publish workflow.

### Release status

- GitHub release path is ready.
- npm package is prepared for scoped public publishing.
