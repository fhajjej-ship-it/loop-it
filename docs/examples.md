# Examples

Use these prompts after installing Loop it.

## Run the right loop from repo context

```bash
npx @fhajjej/loop-it@latest run \
  --goal "Inspect this repo and run the right loop" \
  --agent codex
```

`run` inspects repo signals, recommends the highest-confidence loop, infers a verifier when it can, and writes a run-mode launch prompt. The agent still has to execute the prompt, edit real project files when needed, and verify the result.

## Write a verifier-gated loop

```bash
npx @fhajjej/loop-it@latest write \
  --goal "Fix failing checkout tests" \
  --check "npm test -- checkout" \
  --max-iterations 5
```

This writes `.loop-it/LOOP.md` and `.loop-it/progress.json`. It prepares the loop contract; it does not repair code until an agent runs it.

## Start a verifier-gated loop

```bash
npx @fhajjej/loop-it@latest start \
  --goal "Fix failing checkout tests" \
  --check "npm test -- checkout" \
  --max-iterations 5 \
  --agent all
```

Paste the relevant prompt from `.loop-it/LAUNCH.md` into Codex, Claude Code, or Cursor. That pasted prompt is what asks the agent to inspect, edit, verify, and report. The generated contract uses `DISCOVER -> PLAN -> EXECUTE -> VERIFY -> ITERATE` and stops when the verifier passes, the iteration cap is reached, repeated failure is detected, or approval is required. If an iteration only creates or edits `.loop-it` files, it has not repaired the issue yet.

## End-to-end library flow

```bash
npx @fhajjej/loop-it@latest recommend --goal "fix failing checkout test"
npx @fhajjej/loop-it@latest new --from failing-ci-repair
```

Run the generated loop with Codex, Claude Code, Cursor, or another `SKILL.md`-compatible agent. Do not treat the generated files as the fix. After each pass, update `.loop-it/progress.json` with the last result, blockers, remaining risks, and recommended next action.

```bash
npx @fhajjej/loop-it@latest next --cwd .
```

Use `next` to continue an active loop or select the next loop from recorded progress.

## Codex: ticket to verified fix

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

## Claude Code: docs sweep

```text
/loop-it create a docs sweep loop for this repository.

Objective:
Make setup docs match the current CLI and package behavior.

Success check:
Run every documented command that can be safely run locally.

Iteration budget:
3 passes maximum.
```

## Cursor: review repair

```text
/loop-it design a review repair loop for the current diff.

Objective:
Address blocking correctness, test, and UX findings without broad refactors.

Success check:
The changed files pass the narrowest relevant lint, type-check, or manual review.

Iteration budget:
2 passes maximum.
```

## Durable loop file

```bash
node ./bin/loop-it.mjs new \
  --name "Release readiness" \
  --objective "Prepare the repo for a public release" \
  --check "npm run check" \
  --max-iterations 3
```

## Launch from a library loop

```bash
node ./bin/loop-it.mjs write \
  --from failing-ci-repair \
  --goal "Fix the failing CI job with the smallest safe change" \
  --check "npm run check"

node ./bin/loop-it.mjs start \
  --from failing-ci-repair \
  --goal "Fix the failing CI job with the smallest safe change" \
  --check "npm run check" \
  --agent codex
```

## Find a loop from the library

```bash
node ./bin/loop-it.mjs run --goal "Inspect this repo and run the right loop" --agent codex
node ./bin/loop-it.mjs library search "failing ci"
node ./bin/loop-it.mjs library eval
node ./bin/loop-it.mjs recommend --goal "fix failing checkout test"
node ./bin/loop-it.mjs new --from failing-ci-repair
```

## Recommend the next loop from progress

```bash
node ./bin/loop-it.mjs next --cwd .
```

`next` reads `.loop-it/progress.json` first, then falls back to `.loop-it/LOOP.md`.
