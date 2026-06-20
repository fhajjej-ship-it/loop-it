# Loop it

Loop it is a portable Agent Skill for setting bounded coding loops in Codex, Claude Code, Cursor, and other tools that understand `SKILL.md`.

The goal is not to replace the Forward Future Loop Library. The useful version 1 is a small adapter: it helps an agent pick or design a loop, add checks and stop conditions, then run one verified iteration at a time.

## What it includes

- `skills/loop-it/SKILL.md`: the canonical portable skill.
- `skills/loop-it/references/loop-template.md`: a durable loop state template.
- `skills/loop-it/scripts/create-loop.mjs`: a zero-dependency loop contract generator.
- `bin/loop-it.mjs`: installer and loop file helper.
- `.codex-plugin/plugin.json`: Codex plugin metadata that points at the same skill.

## Install locally from this repo

```bash
npm install
node ./bin/loop-it.mjs install --agent all --scope project
```

That copies the skill into:

- Codex: `.agents/skills/loop-it/`
- Claude Code: `.claude/skills/loop-it/`
- Cursor: `.cursor/skills/loop-it/`

For a global install:

```bash
node ./bin/loop-it.mjs install --agent all --scope global
```

## Install from GitHub

If your agent supports the Agent Skills installer:

```bash
npx skills add fhajjej-ship-it/loop-it --skill loop-it -g
```

Or clone the repo and run the bundled installer:

```bash
git clone https://github.com/fhajjej-ship-it/loop-it.git
cd loop-it
node ./bin/loop-it.mjs install --agent all --scope global
```

## Use it

Codex:

```text
Use $loop-it to turn this flaky-test task into a bounded repair loop.
```

Claude Code:

```text
/loop-it create a docs sweep loop for this repository
```

Cursor:

```text
/loop-it design a performance loop for the slow dashboard route
```

## Create a loop state file

```bash
node ./bin/loop-it.mjs new \
  --name "Docs sweep" \
  --objective "Find and update stale setup documentation" \
  --check "run the documented setup commands from a clean checkout" \
  --max-iterations 3
```

This creates `.loop-it/LOOP.md` in the current directory.

## Version 1 boundaries

Loop it deliberately avoids scheduling, production automation, multi-agent orchestration, billing, dashboards, and external-message sending. Those should come after a manual loop proves the workflow is worth automating.

## References

- Forward Future Loop Library: https://signals.forwardfuture.ai/loop-library/
- OpenAI Codex Agent Skills: https://developers.openai.com/codex/skills
- Claude Code Skills: https://code.claude.com/docs/en/skills
- Cursor Skills and Rules: https://cursor.com/docs/skills and https://cursor.com/docs/rules
