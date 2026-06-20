# Contributing

Thanks for helping improve Loop it. The project is intentionally small: one portable Agent Skill, one installer CLI, and clear verification around install behavior.

## Development setup

```bash
git clone https://github.com/fhajjej-ship-it/loop-it.git
cd loop-it
npm run check
```

## Before opening a PR

- Keep the change focused on one behavior, doc surface, or release task.
- Run `npm run check`.
- If you change installer behavior, confirm Codex, Claude Code, and Cursor install paths still work.
- If you change skill behavior, update `skills/loop-it/SKILL.md` and any affected examples together.
- Do not add production automation, scheduling, dashboards, external messaging, or multi-agent orchestration to version 1.

## Pull request checklist

- [ ] The reason for the change is clear.
- [ ] `npm run check` passes.
- [ ] New docs match the current CLI and skill behavior.
- [ ] npm publishing claims are not made unless the package is actually published.
- [ ] No credentials, private URLs, or unrelated generated files are included.

## Release-sensitive changes

Changes to these files should be reviewed carefully:

- `bin/loop-it.mjs`
- `skills/loop-it/SKILL.md`
- `skills/loop-it/scripts/create-loop.mjs`
- `package.json`
- `.github/workflows/*`
- `.codex-plugin/plugin.json`
- `.claude-plugin/plugin.json`
- `.cursor-plugin/plugin.json`
