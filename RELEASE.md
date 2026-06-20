# Release checklist

Use this checklist before publishing `loop-it` to npm.

## Preconditions

- Confirm the package name is still available or owned by this project:

```bash
npm view loop-it name version
```

- Authenticate locally with `npm login`, or add `NPM_TOKEN` to GitHub Actions secrets.
- Confirm the working tree is clean except intentional release changes.

## Local checks

```bash
npm run check
npm publish --dry-run --access public
```

The check script verifies:

- CLI syntax for `bin/loop-it.mjs`
- loop generator syntax for `skills/loop-it/scripts/create-loop.mjs`
- plugin metadata JSON
- project installs for Codex, Claude Code, and Cursor
- `.loop-it/LOOP.md` creation
- execution from a packed npm tarball
- npm package contents through `npm pack --dry-run`

## Publish

Local publish:

```bash
npm publish --access public
```

GitHub publish:

1. Add `NPM_TOKEN` as a repository secret.
2. Run the `Publish` workflow from GitHub Actions.

## Post-publish verification

```bash
npm view loop-it name version bin
npx loop-it@latest install --agent all --scope project --cwd /tmp/loop-it-npx-smoke
```

After npm is live, make the product page use `npx loop-it@latest install --agent all --scope project` as the primary command.
