# Cursor

Add the Loop It skill to the workspace, then paste or write a normal-language goal in Agent chat. Users do not need to generate a terminal command to begin.

```text
Review this mobile journey, fix its highest-impact usability problem, and return before-and-after evidence.
```

```text
Create a clickable local prototype for this onboarding path and score it against the supplied acceptance criteria.
```

## Prompt behavior

- A matching loop goal defines its required inputs, expected deliverable, proof rubric, iteration cap, stop rules, and approval gates.
- Advanced engineering prompts ask the agent to handle safe repository checks and return evidence.
- The complete task remains understandable as a normal message even without skill-specific syntax.
- Cursor rules are suitable for always-on project conventions; Loop It prompts are for bounded, evidence-producing tasks.
- External writes and irreversible actions remain approval-gated.

Recommended Cursor use:

- editor-local product and design passes;
- small diff review;
- performance or UX checks while staying close to source files;
- bounded tasks that should not become always-on project rules.

Maintainers working on a project-local development copy can use the [local installation notes](../install.md).
