# Reviewer FAQ

## What is Loop it?

Loop it is a portable Agent Skill that helps coding agents run bounded, verifiable loops instead of vague open-ended improvement passes.

## What does it install?

It copies `skills/loop-it/` into one or more agent skill directories:

- Codex: `.agents/skills/loop-it/`
- Claude Code: `.claude/skills/loop-it/`
- Cursor: `.cursor/skills/loop-it/`

## Does it call external services?

No. The installer and loop-file generator run locally.

## Does it send messages, deploy, or change production data?

No. The skill explicitly keeps production writes, deploys, external messages, credentials, destructive git operations, and irreversible data changes behind approval gates.

## What should reviewers test first?

```bash
npm run check
node ./bin/loop-it.mjs install --agent all --scope project --cwd /tmp/loop-it-review
node ./bin/loop-it.mjs new --name "Review" --objective "Check install" --check "manual inspection"
```

## Why is npm not the primary public install yet?

The package is npm-ready, but publishing requires an authenticated npm session or a GitHub `NPM_TOKEN` secret. Until that release happens, the clone-based install is the truthful public path.

## What is intentionally out of scope?

Scheduling, background automation, dashboards, multi-agent orchestration, billing, production deploy automation, and external-message sending.
