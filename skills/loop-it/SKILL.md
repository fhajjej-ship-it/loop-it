---
name: loop-it
description: Choose, compile, launch, or run bounded AI-agent goals with explicit deliverables, proof rubrics, verifier gates, iteration caps, stop conditions, and approval boundaries. Includes a categorized Loop goals library for product, design, research, content, data, and operations plus advanced engineering loops for Codex, Claude Code, Cursor, and other SKILL.md-compatible agents. Use when the user says "loop it", asks for a loop goal, asks what should be looped next, or wants iterative improvement with proof. Do not use for simple one-shot edits unless the user asks for a repeatable loop.
---

# Loop It

Turn an open-ended objective into a bounded run with a concrete artifact and proof. Loop It has two related libraries:

- `references/library/goals.json`: the user-facing, categorized Loop goals library for product, design, research, content, data, and operations work.
- `references/library/loops.json`: advanced execution patterns for repository repair, verification, scheduling, and proactive routines.

Loop goals describe the review-ready deliverable the user wants. Advanced loops describe how an engineering or operational task should iterate. Do not collapse these concepts or route a creative deliverable request into a repository repair loop.

Loop It's repository execution path is primarily for **goal-based coding loops** with an automated verifier. Its Loop goals library is prompt-first: one complete natural-language prompt tells the agent to work toward the declared local deliverable, critique it against a rubric, refine it within the iteration cap, and return rubric evidence or a clear blocker. Rubric completion is not automatic human approval.

Never give the user a terminal command as the way to start a task. Run helper scripts internally when useful, then return or open one normal-language agent prompt. Do not show package-manager commands, shell snippets, `codex exec`, or generated launch commands in user-facing output.

## Internal Helper Boundary

This skill file includes exact CLI examples for maintainers and for an agent operating inside the plugin repository. They are internal implementation notes only. An executing agent may use them silently, but must never copy them into a generated launch prompt, product page, or end-user answer. The same boundary applies to host-specific dollar or slash invocation tokens: they are integration metadata, not instructions to give the user. End users start with a normal-language request or a self-contained normal-language prompt.

## Decision

First decide which mode the user needs. Bias toward **Run now** when the user asks to fix, improve, debug, harden, ship, clean up, or otherwise change a codebase.

- **Find a loop goal**: select a categorized goal from `references/library/goals.json`, collect only its required inputs, and compile one complete normal-language prompt.
- **Use a loop goal**: work toward the declared review-ready deliverable, critique it against every proof criterion, refine it within the cap, and return rubric evidence or a clear blocker.
- **Write a loop**: author a custom loop contract with a concrete goal, verifier, cap, stop rules, approval gates, and evidence fields.
- **Find from library**: select a bundled loop for the user's goal.
- **Next from progress**: inspect `.loop-it/progress.json` or `.loop-it/LOOP.md` and recommend what to loop next.
- **Launch from goal**: compile a goal, verifier, cap, stop conditions, approval gates, and host-specific launch prompt. This prepares the loop; it does not repair code until an agent runs the launch prompt.
- **Design only**: produce a reusable loop prompt or project-local loop file without claiming the issue was fixed.
- **Run now**: inspect the target codebase, select the right loop, execute bounded iterations, edit when needed, verify after each pass, record evidence, and stop on proof, repeated failure, blocker, approval need, or the iteration cap.
- **Doctor**: explain whether Loop It is installed, current, scheduled, and able to run Codex or GitHub-backed loops.
- **Schedule/tick**: for time-based or proactive loops, create `.loop-it/schedules/<id>.json`; add `--heartbeat codex` when the user expects a native Codex Scheduled task to call `tick`.
- **Connector intake**: for GitHub PR work, read PR signals with `gh`, choose a PR/CI/review loop, write `.loop-it/connectors/github/<id>.json`, and schedule a Codex tick without sending external messages.
- **Export/install**: adapt the same loop for Codex, Claude Code, Cursor, or another SKILL.md-compatible agent.

If a prompt says "Run The Loop mode", "run the prompt", "fix the issue", or "repair", treat it as **Run now**. Do not create another loop contract as the main output.
If the user says "loop it", "fix this", "improve this repo", "what should we tackle next", or gives a broad codebase goal, use the `codebase-intake-to-running-loop` path first: inspect the repo, recommend one concrete loop, name the verifier, then run that loop.

If the goal asks for a product, design, research, content, data, or operations deliverable, check the Loop goals library before the engineering loop library. A specific matching loop goal outranks generic codebase intake. Do not infer repository intent merely because the current workspace contains code.

If the task is vague, do not ask a broad discovery questionnaire. First recommend the best likely library loop and state the assumption. Ask up to three targeted questions only when the goal, success check, repository scope, or approval boundary is genuinely blocking.

## Default Run Flow

When the user expects work to happen, do this instead of only writing `.loop-it` files:

1. Classify the request as a loop goal or an advanced repository loop.
2. For a loop goal, inspect only the declared inputs, work toward the expected deliverable, critique it against the proof rubric, refine it, and return rubric evidence or a clear blocker.
3. For a repository loop, inspect active progress, package scripts, CI config, README setup commands, and test config; select one advanced loop and run the narrowest safe verifier.
4. Update portable progress state when it exists.
5. Stop with proof, a real blocker, or one targeted question. Do not stop merely because loop state was created.

## Contract

Every loop needs these fields before execution:

- Loop type: `turn-based`, `goal-based`, `time-based`, or `proactive`. Loop type describes cadence, not subject matter.
- Objective: the concrete outcome, not a theme.
- Scope: repository, files, feature area, data source, or environment.
- Success check: automated project proof, measurable threshold, or an explicit artifact rubric that can reject weak output.
- Iteration cap: maximum passes or time budget.
- Stop conditions: success, no meaningful improvement, repeated failure, blocked access, unsafe action, or approval requirement.
- Evidence: what to record after each pass.
- Approval gates: production writes, external messages, payments, destructive git operations, credentials, deploys, or irreversible data changes.

Push back when the requested loop is just "keep improving" without a check. Offer a smaller loop with a clear check instead.

Use the loop type to set expectations:

- `turn-based`: one prompt/response cycle that may inspect, edit once, verify once, or ask for context.
- `goal-based`: Loop It's primary executable path; run bounded passes until the verifier proves the goal or a stop condition fires.
- `time-based`: interval or scheduled polling; Loop It can write a schedule record and run due ticks through Codex. Use `--heartbeat codex` to create/update the local Codex Scheduled heartbeat, or use cron, launchd, GitHub Actions, or another approved heartbeat to call `tick`.
- `proactive`: event or schedule-driven routine without a human in real time; Loop It can run Codex-only scheduled ticks when a connector supplies a safe command/check. `--heartbeat codex` covers the Codex schedule; the event source, connector, and approval boundary stay outside Loop It.

## Select A Loop

Prefer a bundled loop goal or advanced loop over inventing a new contract from scratch.

For non-engineering work, read `references/library/goals.json`. The starter set includes:

- Product & UX: First Value Sprint and Mobile Journey Rescue.
- Design & Prototyping: Visual Consistency Pass and Clickable Flow Prototype.
- Research & Decisions: Feedback Theme Synthesis and Competitor Evidence Brief.
- Content & Messaging: Landing Page Message Pass and Source-to-Content Pack.
- Data & Evaluation: Data Quality Snapshot and Experiment Results Brief.
- Operations & Support: SOP From Messy Notes and Support Knowledge Gap Audit.

Each loop goal declares its required inputs, expected deliverable, proof rubric, evidence, iteration cap, capabilities, reliability, and approval gates. Keep experimental goals labeled experimental until repeated real runs support promotion.

Use the selector script when available:

```bash
node <skill-dir>/scripts/select-loop.mjs list
node <skill-dir>/scripts/select-loop.mjs search "failing ci"
node <skill-dir>/scripts/select-loop.mjs recommend --goal "fix failing checkout test"
node <skill-dir>/scripts/select-loop.mjs next --cwd <project>
node <skill-dir>/scripts/select-loop.mjs eval
```

Resolve `<skill-dir>` to this skill's folder. In Claude Code, `${CLAUDE_SKILL_DIR}` may be available. In other agents, locate the directory that contains this `SKILL.md`.

When selecting:

1. Check `.loop-it/progress.json` first when the user asks what to loop next.
2. If progress is schedule-owned and already records a recommended next action, preserve that action instead of selecting an unrelated library loop, including after a passing tick records `completed`.
3. Match product, design, research, content, data, and operations artifact requests against `references/library/goals.json`.
4. Match repository repair, release, scheduled, and connector work against `references/library/loops.json`.
5. Recommend one loop goal or advanced loop, plus at most two alternatives.
6. Explain the match in one sentence.
7. Ask only for a missing required input or proof boundary.
8. If no library item fits, design a custom loop and say it should be considered for the library after it proves useful.

Read `references/library/loops.json` only when the selector script is unavailable or manual inspection is needed. Read `references/loop-template.md` when the task needs the generic durable state shape.

Current library categories include:

- Turn-based: code path explanation, small edit verification, diff review pass, error explanation debug, and UI copy clarity pass.
- Goal-based: codebase intake to running loop, failing CI repair, ticket to verified fix, security hardening, and release readiness.
- Time-based: PR review watch, CI health watch, daily dependency watch, docs freshness watch, and production smoke watch.
- Proactive: incoming bug triage routine, dependency upgrade queue routine, review comment resolver routine, customer feedback action routine, and weekly code health routine.

The library entries include loop type, example prompts, counterexamples, required signals, example checks, common misroutes, reliability metadata, and plain-language `userGuide` fields. Prefer the `userGuide` fields when explaining a loop to a new user, then use the reliability and routing fields to justify why one loop fits better than another. Do not describe a loop as proven unless its reliability metadata says so; most bundled loops are starter recipes with verifier gates, not guaranteed outcomes.

## Launch A Loop

For finish-line work, prefer a launch contract over a loose prompt. Use the launcher script when available:

```bash
node <skill-dir>/scripts/start-loop.mjs --goal "Fix failing checkout tests" --check "npm test -- checkout" --agent all
node <skill-dir>/scripts/start-loop.mjs --from failing-ci-repair --goal "Fix failing CI" --check "npm run check" --agent codex
```

The launcher writes:

- `.loop-it/LOOP.md`: durable goal, verifier, protocol, caps, and stop rules.
- `.loop-it/progress.json`: machine-readable status and evidence fields.
- `.loop-it/LAUNCH.md`: Codex, Claude Code, and/or Cursor launch prompts.

This is a preparation step. The `.loop-it` files are the contract and launch map; they do not fix the issue by themselves. To run the repair, paste the relevant prompt from `.loop-it/LAUNCH.md` into the target agent or explicitly ask the current agent to run the loop now.

For a useful launch, require a verifier gate. Do not start a loop from only "improve this" or "keep going" unless you can name how bad output will be rejected.

## Draft The Loop

Use this structure for loop prompts and state files:

1. State the goal and non-goals.
2. Define the repeated action in one tight cycle: inspect, act, verify, record, decide.
3. Name the exact verification command or manual check.
4. Define the iteration cap and stop conditions.
5. Define what the final report must include.

Keep version 1 narrow: one repository, one primary role, one primary success check. Use scheduling only after the same verifier-gated loop has proven useful. Delay dashboards, broad multi-agent orchestration, hosted automation, and production automation until a manual loop has proven useful.

When a durable state file is useful, create `.loop-it/LOOP.md` from `references/loop-template.md` or run:

```bash
node <skill-dir>/scripts/create-loop.mjs --goal "Fix failing checkout tests" --check "npm test -- checkout" --require-fields
node <skill-dir>/scripts/create-loop.mjs --name "Loop name" --objective "Concrete outcome" --check "Verification command or criterion"
node <skill-dir>/scripts/create-loop.mjs --from failing-ci-repair
```

Library-backed loop files also create `.loop-it/progress.json` unless `--no-progress` is passed.

## Host Goal Behavior

Loop It compiles normal-language prompts and portable loop state. The user should receive one prompt, never a terminal command or command-generation walkthrough.

- **Codex**: Generate a normal-message prompt with the objective, artifact or verifier, iteration cap, stop conditions, approval gates, and evidence requirements.
- **Claude Code**: Generate the same normal-message task contract. Keep `.loop-it` files as optional shared portable state.
- **Cursor**: Generate the same normal Agent-chat prompt with scoped output and proof.

Never describe generated `.loop-it` files as a completed repair. Say whether the result is a local artifact, rubric evidence, automated verifier evidence, or a blocker.

## Run The Loop

Use this mode when the user expects the issue to be fixed, not merely prepared. A run must inspect the target repo, make the smallest credible change when needed, execute the verifier, and report evidence.

Run-mode guardrail: `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md` are state files, not the repair. Changes only under `.loop-it` do not count as a successful iteration. If the first pass only created or edited loop files, keep going: run the verifier, inspect the failing surface, and make a real project change when the verifier fails.

Before unattended execution, run a readiness preflight. A loop can execute only when the goal is concrete, the verifier is an automated command, the iteration cap is present, and the next action does not require production writes, external messages, payments, destructive git operations, credential changes, deploys, publishing, or irreversible data changes. If any of those are missing, do not start Codex; ask for the missing verifier, prepare a manual launch only, or stop for explicit approval.

Use the runner script when available to convert broad requests into a selected loop and run-mode launch contract. Add `--execute codex` when the current machine should call Codex CLI, rerun the verifier after each pass, repeat up to the iteration cap, print a `Run proof` summary on success, and update `.loop-it/progress.json` with pass, repeated-failure, cap, or blocker evidence:

```bash
node <skill-dir>/scripts/run-loop.mjs --goal "Inspect this repo and run the right loop" --agent codex
node <skill-dir>/scripts/run-loop.mjs --goal "Fix failing checkout tests" --check "npm test -- checkout" --agent codex
node <skill-dir>/scripts/run-loop.mjs --goal "Fix failing checkout tests" --check "npm test -- checkout" --agent codex --execute codex
node <skill-dir>/scripts/run-loop.mjs --goal "Fix failing checkout tests" --check "npm test -- checkout" --agent codex --execute codex --checker codex
node <skill-dir>/scripts/run-loop.mjs --goal "Fix failing checkout tests" --check "npm test -- checkout" --agent codex --execute codex --checker codex --worktree
```

Use `--checker codex` when the run needs maker-checker proof. The checker is a second read-only Codex pass after the verifier passes; it must inspect the changed files, verifier output, Codex output, and `.loop-it/progress.json`, then return a pass, blocker, or inconclusive receipt. If no checker is requested, the proof must say the checker was skipped.

Use `--worktree` when the run should happen away from the current checkout. It creates a fresh git worktree and branch from `origin/main`, `main`, `origin/master`, `master`, or `HEAD`; runs Codex inside that worktree; and records the worktree path, branch, and base ref in `.loop-it/progress.json`. Use `--worktree-base`, `--worktree-branch`, or `--worktree-dir` when the base, branch name, or path must be explicit.

When `--execute codex` succeeds, progress must include a machine-readable `proof` object with the selected loop, executor, verifier, checker result, final Codex output file, changed files, worktree metadata when isolation was used, and per-iteration evidence. Treat missing proof as incomplete even if `.loop-it` files were created.

Use execution mode only for local, verifier-gated repository work. Do not use it for production writes, external messages, payments, destructive git operations, credential changes, deploys, or irreversible data changes without explicit approval.

For each iteration:

1. Re-read the objective, success check, cap, and approval gates.
2. Inspect only the context needed for the next bounded action.
3. Make the smallest credible change.
4. Run the narrowest relevant verification first, then broader checks only if needed.
5. Record evidence in `.loop-it/LOOP.md` when a state file exists and update `.loop-it/progress.json` when present.
6. Decide: stop, continue, ask approval, or report blocked.

Stop immediately when continuing would require hidden assumptions about safety, credentials, production data, billing, user messaging, destructive git operations, or deployment approval.

Do not describe an exhausted, blocked, or partially verified loop as complete. Say exactly which condition stopped it and what evidence exists.

## Schedule The Loop

Use schedule mode only when the user asks for a time-based or proactive loop to run again later. Do not schedule `goal-based` or `turn-based` loops.

```bash
node <skill-dir>/scripts/schedule-loop.mjs schedule --from ci-health-watch --every 10m --check "npm run check" --execute codex --heartbeat codex
node <skill-dir>/scripts/schedule-loop.mjs list
node <skill-dir>/scripts/schedule-loop.mjs pause --id ci-health-watch
node <skill-dir>/scripts/schedule-loop.mjs resume --id ci-health-watch
node <skill-dir>/scripts/schedule-loop.mjs tick --all --execute codex
```

Schedule mode is Codex-only. `schedule` writes `.loop-it/schedules/<id>.json` with the selected time-based or proactive library loop, goal, verifier, interval, next run time, and worktree preference. With `--heartbeat codex`, it also writes or updates the local Codex automation file under `~/.codex/automations/<id>/automation.toml`, so the schedule appears in Codex Scheduled and calls `tick`. `tick` runs each due schedule once: first it runs the verifier, records proof if the verifier already passes, and only calls the run loop through Codex when the verifier fails.

The heartbeat is not hosted by Loop It. A user, cron, launchd, GitHub Actions, Codex Scheduled automation, or a plugin connector must call `tick`. Do not claim Loop It is polling, listening, or running in the background unless such a caller is actually configured or `--heartbeat codex` successfully created the local Codex automation.

Use `doctor` when the user asks whether the plugin, schedule, or connector is working:

```bash
node <skill-dir>/scripts/doctor.mjs --cwd <project>
node <skill-dir>/scripts/doctor.mjs --cwd <project> --json
```

Doctor must report package version, npm latest version when available, personal Codex plugin cache version, project skill install, Codex CLI availability, local schedules, configured Codex heartbeat files, and GitHub CLI auth when GitHub connector state exists. Treat `missing-heartbeat`, `missing-codex-cli`, and `missing-gh-auth` as real blockers for unattended scheduled runs.

For scheduled ticks:

1. Require `--execute codex`.
2. Prefer worktree isolation unless the user or fixture passes `--no-worktree`.
3. Respect lock files under `.loop-it/schedules/*.lock`; skip locked schedules instead of running twice.
4. Record schedule evidence in `.loop-it/progress.json`.
5. Stop or report blocked for production writes, external messages, payments, credential changes, deploys, destructive git operations, or irreversible side effects.

## Connector Intake

Use connector intake only when the user asks Loop It to watch or react to an approved external source. Connector intake is local and read-only by default.

For GitHub pull requests, use the connector script when available:

```bash
node <skill-dir>/scripts/github-connector.mjs pr --repo owner/repo --pr 123 --every 10m --execute codex --heartbeat codex
```

The GitHub connector:

1. Reads PR metadata through `gh pr view`.
2. Selects `review-comment-resolver-routine` for `CHANGES_REQUESTED`, `ci-health-watch` for failing or blocked checks, or `pr-review-watch` for observation.
3. Writes `.loop-it/connectors/github/<id>.json` with the snapshot, selected loop, verifier, and approval gates.
4. Creates a time/proactive schedule with `checker: codex` by default.
5. Never comments, pushes, requests review, merges, deploys, publishes, or changes GitHub state without explicit approval.

If `gh` is unavailable or unauthenticated, report the connector blocker and ask the user to restore access through their approved GitHub authentication flow. Do not print a terminal command or fake connector evidence.

## Export

Use the same loop text across tools, with only the internal host integration changing:

- Codex: install under `.agents/skills/loop-it/` or as a Codex plugin, then let the user start with a normal-language request or product-page prompt.
- Claude Code: install under `.claude/skills/loop-it/`, then let the user start with the same normal-language task contract.
- Cursor: install under `.cursor/skills/loop-it/`, then use the same normal Agent-chat prompt. Use Cursor rules for always-on project conventions, not for this procedural loop.

When exporting, keep one canonical loop body and avoid tool-specific syntax unless that tool requires it.
