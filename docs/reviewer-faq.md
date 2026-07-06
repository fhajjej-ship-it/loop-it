# Reviewer FAQ

## What is Loop it?

Loop it is a portable loop router, library, launcher, runner, and Agent Skill that turns a coding goal into a verifier-gated run: inspect the repo, recommend a loop, run or prepare the agent prompt, and keep work bounded by proof.

## What does it install?

It copies `skills/loop-it/` into one or more agent skill directories:

- Codex: `.agents/skills/loop-it/`
- Claude Code: `.claude/skills/loop-it/`
- Cursor: `.cursor/skills/loop-it/`

## Does it call external services?

No. The installer, loop launcher, selector, and loop-file generator run locally.

## Does it send messages, deploy, or change production data?

No. The skill explicitly keeps production writes, deploys, external messages, credentials, destructive git operations, and irreversible data changes behind approval gates.

## What should reviewers test first?

```bash
npm run check
npm run smoke:run-proof
node ./bin/loop-it.mjs install --agent all --scope project --cwd /tmp/loop-it-review
node ./bin/loop-it.mjs run --goal "Inspect this repo and run the right loop" --agent codex --cwd /tmp/loop-it-review
node ./bin/loop-it.mjs write --goal "Check install" --check "manual inspection"
node ./bin/loop-it.mjs start --goal "Check install" --check "manual inspection" --agent all
```

## What does `loop-it start` create?

It creates `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md`. The launch file contains Codex, Claude Code, and/or Cursor prompts that carry the goal, verifier, iteration cap, stop conditions, approval gates, and evidence rules.

## Does `loop-it start` fix code by itself?

No. `loop-it start` prepares the loop contract and launch prompt. The repair starts only after the launch prompt is run inside Codex, Claude Code, Cursor, or another compatible agent.

## Does `loop-it run --execute codex` fix code by itself?

It calls Codex CLI to run the generated contract, reruns the verifier after each pass, and repeats up to the iteration cap. On success it prints a `Run proof` summary and records a machine-readable `proof` object in `.loop-it/progress.json`. Add `--checker codex` when the run needs a second, read-only Codex receipt before completion. If Codex is unavailable, the verifier is manual, the checker blocks, the same failure repeats, or the iteration cap is reached, progress is marked blocked or active instead of completed.

The public-package proof command is `npm run smoke:public-codex -- --keep`. It installs `@fhajjej/loop-it@latest` into a fresh fixture and exercises the actual public `loop-it run --execute codex` path, so it is intentionally separate from normal CI checks and requires local Codex CLI auth.

## What is intentionally out of scope?

Scheduling, background automation, dashboards, multi-agent orchestration, billing, production deploy automation, and external-message sending.
