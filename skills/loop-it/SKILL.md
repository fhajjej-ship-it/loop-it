---
name: loop-it
description: Find, recommend, design, adapt, export, or run bounded AI-agent coding loops from the Loop It library for Codex, Claude Code, Cursor, and other SKILL.md-compatible agents. Use when the user says "loop it", asks what should be looped next, asks to choose a loop from a library, asks to set up an agent loop, or wants iterative code improvement, debugging, review, documentation, evaluation, cleanup, or verification with explicit checks and stopping conditions. Do not use for simple one-shot edits unless the user asks for a repeatable loop.
---

# Loop It

Turn an open-ended coding objective into a bounded, verifiable loop. Loop It is also a loop library: choose the right starter loop, adapt it to the user's context, and track progress so the next loop is obvious.

## Decision

First decide which mode the user needs:

- **Find from library**: select a bundled loop for the user's goal.
- **Next from progress**: inspect `.loop-it/progress.json` or `.loop-it/LOOP.md` and recommend what to loop next.
- **Design only**: produce a reusable loop prompt or project-local loop file.
- **Run now**: execute one bounded iteration at a time, verify it, and decide whether another iteration is justified.
- **Export/install**: adapt the same loop for Codex, Claude Code, Cursor, or another SKILL.md-compatible agent.

If the task is vague, do not ask a broad discovery questionnaire. First recommend the best likely library loop and state the assumption. Ask up to three targeted questions only when the goal, success check, repository scope, or approval boundary is genuinely blocking.

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
- Docs sweep: compare docs to implementation, update stale docs, verify examples or links.
- Product evaluation: define scenarios and criteria, test, fix misses, rerun affected and full checks.
- Performance loop: measure baseline, make one focused change, remeasure, keep only proven wins.
- Review repair loop: review diff, fix blocking findings, rerun checks, repeat until only accepted risk remains.
- Fresh setup loop: start from a clean environment, follow documented setup, fix hidden assumptions, retry cleanly.
- Release readiness: verify package, deploy, or public install paths before publishing.
- UX polish, dependency upgrade, security hardening, refactor containment, and test coverage gap loops.

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
node <skill-dir>/scripts/create-loop.mjs --name "Loop name" --objective "Concrete outcome" --check "Verification command or criterion"
node <skill-dir>/scripts/create-loop.mjs --from failing-ci-repair
```

Library-backed loop files also create `.loop-it/progress.json` unless `--no-progress` is passed.

## Host Goal Behavior

Loop It is portable loop state first. Native host automation is optional.

- **Codex**: If the current Codex host exposes a goal/task capability and the user explicitly asks to set a Codex goal, start the native Codex goal using the selected loop objective, success check, stop conditions, and evidence requirements. Also create or update `.loop-it/LOOP.md` and `.loop-it/progress.json` when durable project state is useful.
- **Codex fallback**: If no native goal capability is available, do not claim that a Codex Goal was started. Create the portable loop files and tell the user to run the loop with `$loop-it`.
- **Claude Code**: Claude Code does not have Codex Goals. Create or update `.loop-it/LOOP.md` and `.loop-it/progress.json`, then run one bounded terminal-first pass with `/loop-it`.
- **Cursor**: Cursor does not have Codex Goals. Create or update `.loop-it/LOOP.md` and `.loop-it/progress.json`, then run one bounded Agent-chat pass with `/loop-it` or a direct loop request.

Never describe portable `.loop-it` state as a native Codex Goal. Say which mechanism was used: native Codex goal, portable loop files, or both.

## Run The Loop

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
