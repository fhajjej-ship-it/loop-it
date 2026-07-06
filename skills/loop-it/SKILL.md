---
name: loop-it
description: Write, choose, compile, launch, find, recommend, design, adapt, export, or run bounded AI-agent coding loops with explicit goals, verifier gates, iteration caps, stop conditions, library patterns, and host-specific launch prompts for Codex, Claude Code, Cursor, and other SKILL.md-compatible agents. Use when the user says "loop it", asks what should be looped next, asks to choose a loop from a library, asks to write or set up an agent loop, or wants iterative code improvement, debugging, review, documentation, evaluation, cleanup, or verification with explicit checks and stopping conditions. Do not use for simple one-shot edits unless the user asks for a repeatable loop.
---

# Loop It

Turn an open-ended coding objective into a bounded, verifier-gated run. Loop It helps inspect the codebase, choose from a loop library, run the selected loop, track evidence, and stop when the verifier passes, a blocker is real, or approval is required.

## Decision

First decide which mode the user needs. Bias toward **Run now** when the user asks to fix, improve, debug, harden, ship, clean up, or otherwise change a codebase.

- **Write a loop**: author a custom loop contract with a concrete goal, verifier, cap, stop rules, approval gates, and evidence fields.
- **Find from library**: select a bundled loop for the user's goal.
- **Next from progress**: inspect `.loop-it/progress.json` or `.loop-it/LOOP.md` and recommend what to loop next.
- **Launch from goal**: compile a goal, verifier, cap, stop conditions, approval gates, and host-specific launch prompt. This prepares the loop; it does not repair code until an agent runs the launch prompt.
- **Design only**: produce a reusable loop prompt or project-local loop file without claiming the issue was fixed.
- **Run now**: inspect the target codebase, select the right loop, execute bounded iterations, edit when needed, verify after each pass, record evidence, and stop on proof, repeated failure, blocker, approval need, or the iteration cap.
- **Export/install**: adapt the same loop for Codex, Claude Code, Cursor, or another SKILL.md-compatible agent.

If a prompt says "Run The Loop mode", "run the prompt", "fix the issue", or "repair", treat it as **Run now**. Do not create another loop contract as the main output.
If the user says "loop it", "fix this", "improve this repo", "what should we tackle next", or gives a broad codebase goal, use the `codebase-intake-to-running-loop` path first: inspect the repo, recommend one concrete loop, name the verifier, then run that loop.

If the task is vague, do not ask a broad discovery questionnaire. First recommend the best likely library loop and state the assumption. Ask up to three targeted questions only when the goal, success check, repository scope, or approval boundary is genuinely blocking.

## Default Run Flow

When the user expects work to happen, do this instead of only writing `.loop-it` files:

1. Inspect active `.loop-it/progress.json`, package scripts, CI config, README setup commands, test config, and the user request.
2. Select one loop from the bundled library. Use `codebase-intake-to-running-loop` only when the concrete loop is not obvious yet.
3. Name the verifier. Prefer the user's check; otherwise infer `npm run check`, `npm test`, lint, typecheck, build, or the narrowest project-specific check.
4. Run the verifier or closest safe equivalent before editing when practical.
5. Make the smallest credible project change when the verifier or inspected evidence points to one.
6. Rerun the verifier.
7. Update `.loop-it/progress.json` and `.loop-it/LOOP.md` when they exist.
8. Stop with proof, a real blocker, or one targeted question. Do not stop merely because loop state was created.

## Contract

Every loop needs these fields before execution:

- Objective: the concrete outcome, not a theme.
- Scope: repository, files, feature area, data source, or environment.
- Success check: command, benchmark, manual inspection, review criterion, or measurable threshold.
- Iteration cap: maximum passes or time budget.
- Stop conditions: success, no meaningful improvement, repeated failure, blocked access, unsafe action, or approval requirement.
- Evidence: what to record after each pass.
- Approval gates: production writes, external messages, payments, destructive git operations, credentials, deploys, or irreversible data changes.

Push back when the requested loop is just "keep improving" without a check. Offer a smaller loop with a clear check instead.

## Select A Loop

Prefer the bundled library over inventing a loop from scratch.

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
2. If no progress exists, match the user's goal against `references/library/loops.json`.
3. Recommend one loop, plus at most two alternatives.
4. Explain the match in one sentence.
5. Ask the loop's top questions only if needed.
6. If no library loop fits, design a custom loop and say it should be considered for the library after it proves useful.

Read `references/library/loops.json` only when the selector script is unavailable or manual inspection is needed. Read `references/loop-template.md` when the task needs the generic durable state shape.

Current library categories include:

- Ticket to verified fix: reproduce, diagnose, patch, add regression coverage, verify.
- Failing CI repair: inspect failing output, reproduce, patch, rerun the failed check.
- Flaky test stabilization: reproduce intermittent failures, isolate nondeterminism, prove repeated passes.
- Regression bisect: compare known good and bad behavior, isolate the culprit change, patch current code.
- Deployment preview repair: inspect hosted build/deploy logs, reproduce locally where possible, verify preview status.
- Runtime error triage: map stack traces or logs to the failing path, patch root cause, prove the error is gone.
- API contract drift: align caller, provider, schema, and tests when request or response shapes disagree.
- Docs sweep: compare docs to implementation, update stale docs, verify examples or links.
- Product evaluation: define scenarios and criteria, test, fix misses, rerun affected and full checks.
- Performance loop: measure baseline, make one focused change, remeasure, keep only proven wins.
- Review repair loop: review diff, fix blocking findings, rerun checks, repeat until only accepted risk remains.
- Fresh setup loop: start from a clean environment, follow documented setup, fix hidden assumptions, retry cleanly.
- Release readiness: verify package, deploy, or public install paths before publishing.
- UX polish, dependency upgrade, security hardening, refactor containment, test coverage gap, skill instruction hardening, and codebase intake loops.

The library entries include example prompts, counterexamples, required signals, example checks, common misroutes, reliability metadata, and plain-language `userGuide` fields. Prefer the `userGuide` fields when explaining a loop to a new user, then use the reliability and routing fields to justify why one loop fits better than another. Do not describe a loop as proven unless its reliability metadata says so; most bundled loops are starter recipes with verifier gates, not guaranteed outcomes.

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

Keep version 1 narrow: one repository, one primary role, one primary success check. Delay scheduling, dashboards, multi-agent orchestration, and production automation until a manual loop has proven useful.

When a durable state file is useful, create `.loop-it/LOOP.md` from `references/loop-template.md` or run:

```bash
node <skill-dir>/scripts/create-loop.mjs --goal "Fix failing checkout tests" --check "npm test -- checkout" --require-fields
node <skill-dir>/scripts/create-loop.mjs --name "Loop name" --objective "Concrete outcome" --check "Verification command or criterion"
node <skill-dir>/scripts/create-loop.mjs --from failing-ci-repair
```

Library-backed loop files also create `.loop-it/progress.json` unless `--no-progress` is passed.

## Host Goal Behavior

Loop It compiles host launch prompts and portable loop state. The generated prompts are safe to paste as normal chat messages, with optional skill commands only when the host supports them.

- **Codex**: For finish-line work, generate a normal-message prompt with the objective, verifier, iteration cap, stop conditions, approval gates, and evidence requirements. It may say to use `$loop-it` when available, but it must still tell Codex to run the bounded task directly when the skill or slash commands are unavailable.
- **Claude Code**: Generate a normal-message prompt with the verifier and cap. Use Claude Code `/loop` only for polling or interval work, not for verifier-gated finish-line work. Keep `.loop-it` files as shared portable state.
- **Cursor**: Generate a normal Agent-chat prompt. It may say to use `/loop-it` when available, but it must still run as plain instructions when the skill command is unavailable.

Never describe portable `.loop-it` state as a native host goal. Never describe generated `.loop-it` files as a completed repair. Say which mechanism was used: portable loop files, host skill command, or plain agent prompt.

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
```

Use `--checker codex` when the run needs maker-checker proof. The checker is a second read-only Codex pass after the verifier passes; it must inspect the changed files, verifier output, Codex output, and `.loop-it/progress.json`, then return a pass, blocker, or inconclusive receipt. If no checker is requested, the proof must say the checker was skipped.

When `--execute codex` succeeds, progress must include a machine-readable `proof` object with the selected loop, executor, verifier, checker result, final Codex output file, changed files, and per-iteration evidence. Treat missing proof as incomplete even if `.loop-it` files were created.

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

## Export

Use the same loop text across tools, with only the invocation changing:

- Codex: install under `.agents/skills/loop-it/` or as a Codex plugin, then invoke with `$loop-it`.
- Claude Code: install under `.claude/skills/loop-it/`, then invoke with `/loop-it`.
- Cursor: install under `.cursor/skills/loop-it/`, then invoke from Agent chat with `/loop-it` or by asking for a loop. Use Cursor rules for always-on project conventions, not for this procedural loop.

When exporting, keep one canonical loop body and avoid tool-specific syntax unless that tool requires it.
