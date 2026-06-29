# Reviewer FAQ

## What is Loop it?

Loop it is a portable loop writer, library, launcher, and Agent Skill that turns a coding goal into a verifier-gated loop with an optional host-specific launch prompt.

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
node ./bin/loop-it.mjs install --agent all --scope project --cwd /tmp/loop-it-review
node ./bin/loop-it.mjs write --goal "Check install" --check "manual inspection"
node ./bin/loop-it.mjs start --goal "Check install" --check "manual inspection" --agent all
```

## What does `loop-it start` create?

It creates `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md`. The launch file contains Codex, Claude Code, and/or Cursor prompts that carry the goal, verifier, iteration cap, stop conditions, approval gates, and evidence rules.

## What is intentionally out of scope?

Scheduling, background automation, dashboards, multi-agent orchestration, billing, production deploy automation, and external-message sending.
