# Cursor

Install Loop it into a project:

```bash
node ./bin/loop-it.mjs install --agent cursor --scope project
```

This creates:

```text
.cursor/skills/loop-it/SKILL.md
```

Invoke it in Cursor Agent chat:

```text
/loop-it design a performance loop for the slow dashboard route
```

Goal behavior:

- Cursor does not have Codex Goals.
- Loop it creates portable `.loop-it/LOOP.md` and `.loop-it/progress.json` files when durable state is useful.
- Use Cursor rules for always-on project conventions, not as a replacement for the procedural loop state.

Recommended Cursor use:

- editor-local repair loops;
- small diff review;
- performance or UX checks while staying close to source files;
- procedural loops that should not become always-on project rules.
