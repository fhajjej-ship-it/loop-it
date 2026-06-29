# Cursor

Install Loop it into a project:

```bash
npx @fhajjej/loop-it@latest install --agent cursor --scope project
```

This creates:

```text
.cursor/skills/loop-it/SKILL.md
```

Run the command from the project root, or pass `--cwd /real/path/to/your-project`.

Invoke it in Cursor Agent chat:

```text
/loop-it design a performance loop for the slow dashboard route
```

Generate a Cursor launch prompt:

```bash
npx @fhajjej/loop-it@latest start \
  --goal "Fix failing checkout tests" \
  --check "npm test -- checkout" \
  --agent cursor
```

Cursor launch behavior:

- Cursor does not expose the same native finish-line `/goal` primitive here.
- Loop it creates portable `.loop-it/LOOP.md`, `.loop-it/progress.json`, and `.loop-it/LAUNCH.md` files.
- Paste the generated Cursor prompt into Agent chat. Use Cursor rules for always-on project conventions, not as a replacement for the procedural loop state.

Recommended Cursor use:

- editor-local repair loops;
- small diff review;
- performance or UX checks while staying close to source files;
- procedural loops that should not become always-on project rules.
