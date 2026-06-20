# Examples

Use these prompts after installing Loop it.

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

## Find a loop from the library

```bash
node ./bin/loop-it.mjs library search "failing ci"
node ./bin/loop-it.mjs recommend --goal "fix failing checkout test"
node ./bin/loop-it.mjs new --from failing-ci-repair
```

## Recommend the next loop from progress

```bash
node ./bin/loop-it.mjs next --cwd .
```

`next` reads `.loop-it/progress.json` first, then falls back to `.loop-it/LOOP.md`.
