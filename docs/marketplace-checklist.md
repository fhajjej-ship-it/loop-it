# Marketplace Checklist

Use this checklist before submitting Loop it to agent directories or plugin marketplaces.

## Product basics

- [ ] Clear name: Loop it
- [ ] One-sentence description: Find, recommend, and run bounded agent loops across turn-based, goal-based, time-based, and proactive patterns.
- [ ] Public repo: https://github.com/fhajjej-ship-it/loop-it
- [ ] Product page: https://swarmixai.com/experiments/loop-it-poc
- [ ] License: MIT

## Install proof

- [ ] `npm run check` passes.
- [ ] Fresh project install works for Codex.
- [ ] Fresh project install works for Claude Code.
- [ ] Fresh project install works for Cursor.
- [ ] Fresh project `loop-it write` creates `.loop-it/LOOP.md` and `.loop-it/progress.json`.
- [ ] Fresh project `loop-it start` creates `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md`.
- [ ] Fresh project `loop-it schedule` creates `.loop-it/schedules/<id>.json` for a time-based or proactive loop.
- [ ] Fresh project `loop-it schedule --heartbeat codex` creates or updates a Codex automation file under `~/.codex/automations/<id>/automation.toml`.
- [ ] Fresh project `loop-it tick --all --execute codex` runs due schedules or clearly reports no due schedules.
- [ ] Packed npm tarball execution works.
- [ ] npm publish dry-run passes.

## Review proof

- [ ] README explains install, usage, boundaries, and release status.
- [ ] `docs/examples.md` includes realistic first prompts.
- [ ] `docs/reviewer-faq.md` answers safety and install questions.
- [ ] `SECURITY.md` documents local-only behavior and approval gates.
- [ ] `CHANGELOG.md` describes the initial release.

## Release proof

- [ ] Current GitHub release exists.
- [ ] `@fhajjej/loop-it` npm package is published.
- [ ] Product page install command matches the real public install path.
