# Loop Contract Template

Use this template when a loop needs durable state, handoff, or repeated passes across sessions.

```markdown
# <Loop Name>

Status: draft | active | blocked | complete | stopped
Created: <ISO timestamp>
Owner: <agent or person>

## Objective
<Concrete outcome>

## Non-goals
- <What this loop should not attempt>

## Scope
- Repository/path:
- Inputs:
- External systems:

## Success Check
- Primary check:
- Supporting checks:
- Manual review criteria:

## Iteration Budget
- Max iterations:
- Time budget:
- Stop on repeated failure after:

## Approval Gates
- <Actions that require user approval before proceeding>

## Loop Body
1. Inspect the smallest relevant context.
2. Make one focused change or decision.
3. Run the success check or the narrowest useful proxy.
4. Record evidence and remaining risk.
5. Continue only if the next pass has a clear expected improvement.

## Stop Conditions
- The success check passes.
- The iteration budget is exhausted.
- The same blocker or failure repeats without new evidence.
- Continuing requires approval, credentials, production access, destructive changes, or deployment.
- The loop no longer has a clear next improvement.

## Iteration Log

### Iteration 1
- Action:
- Evidence:
- Result:
- Decision:

## Final Report
- Outcome:
- Evidence:
- Changed files or artifacts:
- Remaining risks:
- Recommended next action:
```

## Starter Shapes

### Ticket To Verified Fix

Use for bugs, failing behavior, customer complaints, and small feature defects.

Loop body: reproduce the issue, identify the smallest root cause, patch it, add or update regression coverage when practical, rerun the reproduction and relevant tests, then decide whether another pass is needed.

Stop when the original reproduction and regression check pass, the issue cannot be reproduced after two serious attempts, or the next step requires product or access clarification.

### Documentation Sweep

Use when docs may be stale or incomplete.

Loop body: compare documentation to actual code behavior, update the highest-impact mismatch, verify commands, examples, links, or screenshots where practical, then rescan for the next highest-impact mismatch.

Stop when no material mismatch remains in scope, verification is blocked, or the iteration cap is reached.

### Evaluation And Repair

Use when product quality needs repeated scenario testing.

Loop body: define realistic scenarios and pass/fail criteria, run them under consistent conditions, fix the underlying cause of failures, rerun affected scenarios, and periodically rerun the full set.

Stop when all scenarios pass, the quality bar needs human judgment, or repeated failures indicate the task needs redesign.

### Performance Improvement

Use when speed, memory, bundle size, or latency needs measurable improvement.

Loop body: record a baseline, make one focused optimization, remeasure under the same conditions, keep the change only if it improves the target without regressing correctness, then target the next bottleneck.

Stop when the threshold is met, measurement is unreliable, or changes stop producing meaningful gains.

### Review Repair

Use when a diff or PR must be hardened before shipping.

Loop body: review for correctness, tests, security, UX, and maintainability risks, fix the highest-severity actionable finding, rerun relevant checks, and repeat until no blocking findings remain.

Stop when only accepted low-risk findings remain, verification is blocked, or the same issue repeats without new evidence.
