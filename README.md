<p align="center">
  <img src="skills/loop-it/assets/loop-it-logo-black.svg" alt="Loop it" width="120" />
</p>

# Loop it

[![Release](https://img.shields.io/github/v/release/fhajjej-ship-it/loop-it?label=release)](https://github.com/fhajjej-ship-it/loop-it/releases)
[![Check](https://github.com/fhajjej-ship-it/loop-it/actions/workflows/check.yml/badge.svg)](https://github.com/fhajjej-ship-it/loop-it/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-111111.svg)](LICENSE)

Loop it is a categorized Loop goals library and Agent Skill for Codex, Claude Code, and Cursor. It turns an open-ended request into one complete, command-free prompt that works toward a review-ready deliverable and returns rubric evidence or a clear blocker, with an iteration cap, stop conditions, and approval gates.

Users start with a normal-language goal. They do not need to copy or run terminal commands.

[Open the Loop It product page](https://swarmixai.com/experiments/loop-it)

## Start with a goal

Choose a loop goal, add the source material it needs, and open the generated prompt in your agent.

```text
Turn these numbered customer comments into traceable themes and recommend one evidence-backed next action. Keep observations, interpretation, and assumptions separate. Return the brief and score it against the supplied proof rubric.
```

```text
Create three landing-page message directions for this audience using only the approved product evidence. Select the strongest direction, mark unsupported claims as assumptions, and return one review-ready concept.
```

```text
Inspect this repository, repair the highest-confidence issue with the smallest scoped change, run the project’s safe local verification inside the agent workflow, and return proof.
```

## Loop goals library

The starter library contains 12 experimental loop goals across six categories.

| Category | Loop goals | Review-ready deliverable |
| --- | --- | --- |
| Product & UX | First Value Sprint; Mobile Journey Rescue | Focused journey improvement with before-and-after evidence |
| Design & Prototyping | Visual Consistency Pass; Clickable Flow Prototype | Reviewable interface change or local prototype |
| Research & Decisions | Feedback Theme Synthesis; Competitor Evidence Brief | Cited research brief with facts and inference separated |
| Content & Messaging | Landing Page Message Pass; Source-to-Content Pack | Review-ready message or draft content set |
| Data & Evaluation | Data Quality Snapshot; Experiment Results Brief | Reconciled quality or decision report |
| Operations & Support | SOP From Messy Notes; Support Knowledge Gap Audit | Usable procedure or prioritized coverage brief |

Every loop goal declares:

- Required inputs
- Expected deliverable
- Proof rubric and evidence
- Iteration cap
- Required capabilities
- Reliability status
- Approval gates

Each loop goal compiles one complete natural-language prompt that works toward a review-ready local deliverable and returns criterion-by-criterion rubric evidence or a clear blocker. Loop goals never publish, send messages, contact people, deploy, purchase, access private systems, or mutate production data without explicit approval.

## How the loop works

Creative and analytical loop goals use one bounded workflow:

```text
UNDERSTAND → CREATE → CRITIQUE → REFINE → PROVE
```

The agent stops when the rubric is satisfied, the iteration cap is reached, the same weakness repeats twice, required context is missing, or approval is needed. A completed rubric means the artifact is ready for review; it does not mean a human automatically approved it.

Advanced repository work uses:

```text
DISCOVER → PLAN → EXECUTE → VERIFY → ITERATE
```

The agent runs safe project checks internally and reports the evidence. The user receives the prompt and proof, not a command-generation walkthrough.

## Advanced loop library

The original 20-loop library remains available for engineering and operational work:

- Turn-based explanation, review, debugging, copy, and small-edit passes
- Goal-based CI repair, ticket repair, security hardening, and release readiness
- Time-based PR, CI, dependency, documentation, and production-smoke watches
- Proactive bug, dependency, review-comment, feedback, and code-health routines

Time-based and proactive loops still require an approved scheduler or connector. Loop It does not claim to run in the background unless that heartbeat is actually configured.

## Prompt-only contract

Generated user prompts must:

- Be normal-language messages that work without a slash command
- Name the goal, artifact or verifier, proof, cap, stop conditions, and approval gates
- Tell the agent to handle safe local verification itself
- Avoid terminal commands and shell snippets
- Keep external writes and irreversible actions behind approval
- Return evidence, assumptions, blockers, remaining risks, and the next safe action

## What is inside

- `skills/loop-it/SKILL.md`: canonical Agent Skill instructions
- `skills/loop-it/references/library/goals.json`: categorized Loop goals library
- `skills/loop-it/references/library/goals-schema.json`: goal-library contract
- `skills/loop-it/references/library/goals-evals.json`: goal-routing evaluation set
- `skills/loop-it/references/library/loops.json`: advanced execution patterns
- `skills/loop-it/scripts/goal-library.mjs`: goal validation, routing, and prompt compiler
- `skills/loop-it/scripts/select-loop.mjs`: advanced loop selector
- `skills/loop-it/scripts/start-loop.mjs`: prompt-only host launch compiler
- `skills/loop-it/scripts/run-loop.mjs`: guarded repository runner and loop-goal prompt router
- `tests/`: install, routing, prompt, readiness, and run-proof checks

## Install

Install Loop It from the Codex plugin interface, or use the product page to open a generated goal in Codex. Project-local installs are also supported for Codex, Claude Code, and Cursor; see [installation notes](docs/install.md) when maintaining a local development copy.

## Reliability

The 12 new loop goals begin as `experimental`. Promote a goal to `tested` only after repeated real runs produce the declared deliverable, satisfy the rubric, preserve safety boundaries, and avoid confident misrouting.

The advanced loop recipes are verifier-gated patterns, not guaranteed outcomes. Loop It reports whether proof passed, failed, was blocked, or still needs review.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and [RELEASE.md](RELEASE.md) for maintainer-only release checks.

## License

[MIT](LICENSE)
