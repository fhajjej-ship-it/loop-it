# Claude Code

Add the Loop It skill to the workspace, then paste or write a normal-language goal. Users do not need to generate a terminal command to begin.

```text
Turn these process notes into a review-ready SOP. Keep missing information visible as questions and score the result against a clear rubric.
```

```text
Fix the failing checkout behavior with the smallest scoped change, run the narrowest safe project check, and return the evidence.
```

## Prompt behavior

- A matching loop goal defines the review-ready deliverable, proof rubric, iteration cap, stop rules, and approval gates.
- Advanced repository prompts retain verifier-gated execution without exposing commands to the user.
- Local Loop It state can preserve progress for repository work, but creating state files alone does not complete the task.
- Recurring work still requires a real approved scheduler; a prompt does not claim background execution.
- External writes and irreversible actions remain approval-gated.

Recommended Claude Code use:

- bounded research, content, and documentation artifacts;
- explicit verification checkpoints;
- readable iteration notes;
- small changes that can be reviewed between passes.

Maintainers working on a project-local development copy can use the [local installation notes](../install.md).
