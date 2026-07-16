# Codex

Install Loop It from the Codex plugin interface, then start with a normal message. The plugin supplies the bounded prompt; users do not need a terminal command or slash command.

```text
Turn these customer comments into traceable themes and recommend one evidence-backed next action.
```

```text
Inspect this repository, repair the highest-confidence issue with the smallest scoped change, and return proof from the project check.
```

## Prompt behavior

- A matching loop goal supplies the required inputs, expected deliverable, proof rubric, iteration cap, stop rules, and approval gates.
- Product, design, research, content, data, and operations loop goals work toward review-ready local deliverables and return rubric evidence or a clear blocker.
- Advanced repository prompts ask Codex to run safe local verification inside the task and return the evidence.
- The prompt works as a normal message even when the plugin is unavailable.
- Publishing, external messages, deploys, payments, credential changes, destructive operations, and irreversible data changes require explicit approval.

Recommended Codex use:

- bounded product and UX improvements;
- research synthesis with source traceability;
- review-ready content and operational artifacts;
- repo-grounded bug fixes and release-readiness passes;
- one explicit proof contract at a time.

Maintainers working on a project-local development copy can use the [local installation notes](../install.md).
