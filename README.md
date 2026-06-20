# Loop it

Loop it is a portable Agent Skill for setting bounded coding loops in Codex, Claude Code, Cursor, and other tools that understand `SKILL.md`.

It turns a vague instruction like "keep fixing it" into a clear loop: choose the agent, choose the job, define proof, set a pass limit, then stop when the loop is done or no longer useful.

Product page: https://swarmixai.com/experiments/loop-it-poc

## Quick start

Clone the repo and install the skill into your current project:

```bash
git clone https://github.com/fhajjej-ship-it/loop-it.git
cd loop-it
node ./bin/loop-it.mjs install --agent all --scope project
```

That copies the skill into:

| Agent | Install path | Invoke with |
| --- | --- | --- |
| Codex | `.agents/skills/loop-it/` | `Use $loop-it` |
| Claude Code | `.claude/skills/loop-it/` | `/loop-it` |
| Cursor | `.cursor/skills/loop-it/` | `/loop-it` |

For a global install:

```bash
node ./bin/loop-it.mjs install --agent all --scope global
```

## Run a loop

Codex example:

```text
Use $loop-it to fix the failing checkout test.

Objective:
Fix the regression without unrelated refactors.

Success check:
npm test -- checkout

Iteration budget:
3 passes maximum.

Stop conditions:
Stop when the test passes with regression coverage, the same failure repeats twice, or approval is needed.
```

Claude Code:

```text
/loop-it create a docs sweep loop for this repository
```

Cursor:

```text
/loop-it design a performance loop for the slow dashboard route
```

## What a good loop includes

- Objective: the concrete outcome, not a theme.
- Scope: repository, files, feature area, data source, or environment.
- Success check: command, benchmark, manual inspection, review criterion, or measurable threshold.
- Iteration cap: maximum passes or time budget.
- Stop conditions: success, repeated failure, blocked access, unsafe action, or approval requirement.
- Evidence: changed files, verification output, residual risk, and the next decision.
- Approval gates: production writes, external messages, payments, destructive git operations, credentials, deploys, or irreversible data changes.

## Create a durable loop file

```bash
node ./bin/loop-it.mjs new \
  --name "Docs sweep" \
  --objective "Find and update stale setup documentation" \
  --check "run the documented setup commands from a clean checkout" \
  --max-iterations 3
```

This creates `.loop-it/LOOP.md` in the current directory.

## What it includes

- `skills/loop-it/SKILL.md`: the canonical portable skill.
- `skills/loop-it/references/loop-template.md`: a durable loop state template.
- `skills/loop-it/scripts/create-loop.mjs`: a zero-dependency loop contract generator.
- `bin/loop-it.mjs`: installer and loop file helper.
- `.codex-plugin/plugin.json`: Codex plugin metadata that points at the same skill.

## Version 1 boundaries

Loop it deliberately avoids scheduling, production automation, multi-agent orchestration, billing, dashboards, and external-message sending. Those should come after a manual loop proves the workflow is worth automating.

## References

- OpenAI Codex Agent Skills: https://developers.openai.com/codex/skills
- Claude Code Skills: https://code.claude.com/docs/en/skills
- Cursor Skills and Rules: https://cursor.com/docs/skills and https://cursor.com/docs/rules
