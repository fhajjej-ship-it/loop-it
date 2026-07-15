# Marketplace Checklist

Use this checklist before submitting Loop it to agent directories or plugin marketplaces.

## Product basics

- [ ] Clear name: Loop it
- [ ] One-sentence description: Run categorized product, design, research, content, data, operations, and engineering goals with proof.
- [ ] Public repo: https://github.com/fhajjej-ship-it/loop-it
- [ ] Product page: https://swarmixai.com/experiments/loop-it
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
- [ ] Fresh project `loop-it schedules list` reports local schedule and heartbeat status.
- [ ] Fresh project `loop-it doctor` reports package, Codex plugin, Codex CLI, schedules, heartbeat files, and GitHub connector readiness when connector state exists.
- [ ] Fresh project `loop-it github pr --repo owner/repo --pr 123 --execute codex --heartbeat codex` creates a read-only connector snapshot and schedule when `gh` is authenticated.
- [ ] Fresh project `loop-it tick --all --execute codex` runs due schedules or clearly reports no due schedules.
- [ ] Packed npm tarball execution works.
- [ ] npm publish dry-run passes.
- [ ] Loop goals library contains 12 goals across six categories and matches its schema.
- [ ] Creative and analytical routing evals pass without stealing explicit engineering requests.
- [ ] Every generated user prompt is normal-language and contains no terminal or slash command.

## Review proof

- [ ] README explains install, usage, boundaries, and release status.
- [ ] `docs/examples.md` includes realistic first prompts.
- [ ] `docs/reviewer-faq.md` answers safety and install questions.
- [ ] `SECURITY.md` documents local-only behavior and approval gates.
- [ ] `CHANGELOG.md` describes the initial release.

## Release proof

- [ ] Current GitHub release exists.
- [ ] `@fhajjej/loop-it` npm package is published.
- [ ] Product page opens or copies a self-contained natural-language prompt and exposes no terminal command.
