# Reviewer FAQ

## What is Loop it?

Loop it is a categorized Loop goals library, bounded runner, and Agent Skill. It routes product, design, research, content, data, operations, and engineering requests into one complete prompt that works toward a review-ready deliverable or verified change and returns rubric evidence or a clear blocker, with an iteration cap and stop rules.

## What does it install?

It copies `skills/loop-it/` into one or more agent skill directories:

- Codex: `.agents/skills/loop-it/`
- Claude Code: `.claude/skills/loop-it/`
- Cursor: `.cursor/skills/loop-it/`

## Does it call external services?

Mostly no. The installer, loop launcher, selector, and loop-file generator run locally. `loop-it schedule --heartbeat codex` writes a local Codex automation file under `~/.codex/automations/`; it does not call a hosted Loop It service. The optional `loop-it github pr` connector reads PR metadata through the user's authenticated `gh` CLI and writes local Loop It state; it does not send comments or change GitHub state.

## Does it send messages, deploy, or change production data?

No. The skill explicitly keeps production writes, deploys, external messages, credentials, destructive git operations, and irreversible data changes behind approval gates.

## What should reviewers test first?

Start with the repository package check. It validates the 12-goal catalog, both routing evaluation sets, prompt-only output guards, fresh host installs, packed contents, readiness behavior, and repository run proof. Then inspect one product or research prompt and one advanced engineering prompt as normal agent messages. A goal prompt should return a review-ready deliverable with rubric evidence or a clear blocker, never imply a guaranteed outcome.

The generated user experience must never expose a terminal command or native slash command. Maintainer-only CLI fixtures may still exercise packaging, installation, scheduling, and non-interactive repository execution behind the scenes.

## What does advanced repository preparation create?

It creates `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md`. The launch file contains Codex, Claude Code, and/or Cursor prompts that carry the goal, verifier, iteration cap, stop conditions, approval gates, and evidence rules.

## Does preparation fix code by itself?

No. Preparation creates the loop contract and a normal-language launch prompt. The repair starts only after the prompt runs inside Codex, Claude Code, Cursor, or another compatible agent.

## Is there still a non-interactive repository runner?

It calls Codex CLI to run the generated contract, reruns the verifier after each pass, and repeats up to the iteration cap. On success it prints a `Run proof` summary and records a machine-readable `proof` object in `.loop-it/progress.json`. Add `--checker codex` when the run needs a second, read-only Codex receipt before completion. If Codex is unavailable, the verifier is manual, the checker blocks, the same failure repeats, or the iteration cap is reached, progress is marked blocked or active instead of completed.

The public-package proof fixture installs the published package into a fresh local workspace and exercises that runner. It is intentionally separate from normal CI checks and requires local Codex authentication. This is maintainer verification, not the public prompt flow.

## What is intentionally out of scope?

Hosted background services, broad external connector platforms, dashboards, broad multi-agent orchestration, billing, production deploy automation, and external-message sending.

Loop it does include a local Codex-only `schedule`/`tick` path for time-based and proactive loops. Add `--heartbeat codex` to create or update the local native Codex Scheduled heartbeat that calls `tick`; otherwise an approved external heartbeat such as cron, launchd, or GitHub Actions must call `tick`.

It also includes a narrow read-only GitHub PR connector. The connector chooses a PR review, CI health, or review-comment loop from the library and creates a local schedule. It requires authenticated GitHub access and keeps GitHub writes behind explicit approval.

`loop-it doctor` explains whether the package, personal Codex plugin cache, project skill install, Codex CLI, schedules, Codex heartbeat files, and GitHub auth are ready. It exits non-zero for blockers such as a missing configured heartbeat, missing Codex CLI, or missing `gh` auth for GitHub-backed schedules.
