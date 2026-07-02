# Release checklist

Use this checklist before publishing `@fhajjej/loop-it`. GitHub is the release source of truth; npm is published by GitHub Actions from a GitHub Release.

## Source of truth

- Start every release branch from current `main`.
- Keep `main` as the canonical source for package code, skill files, plugin manifests, docs, and release notes.
- Publish by creating a GitHub Release whose tag matches `package.json`, for example `v0.3.5`.
- Treat npm as downstream of GitHub Actions. Do not update npm first unless the GitHub workflow is unavailable and this checklist's manual fallback is being used.
- Treat local Codex, Claude Code, Cursor, and plugin installs as generated artifacts. Update source files in this repo first, then regenerate or reinstall local copies from the repo/package.

## Preconditions

- Confirm the scoped package name is available or owned by this project:

```bash
npm view @fhajjej/loop-it name version
```

- Add `NPM_TOKEN` to GitHub Actions secrets.
- Confirm the working tree is clean except intentional release changes.

## Local checks

```bash
npm run check
npm publish --dry-run --access public
```

The check script verifies:

- CLI syntax for `bin/loop-it.mjs`
- loop generator syntax for `skills/loop-it/scripts/create-loop.mjs`
- loop launcher syntax for `skills/loop-it/scripts/start-loop.mjs`
- plugin metadata JSON
- project installs for Codex, Claude Code, and Cursor
- `loop-it write` creation from a goal and verifier
- `.loop-it/LOOP.md` creation
- `.loop-it/LAUNCH.md` creation
- execution from a packed npm tarball
- npm package contents through `npm pack --dry-run`

## Publish

GitHub publish:

1. Commit and push the release changes to `main`.
2. Create a GitHub release whose tag matches `package.json`, for example `v0.3.5`.
3. Let the `Publish` workflow run `npm run check` and publish to npm.

Manual fallback:

Use the `Publish` workflow's manual dispatch from GitHub Actions. Local `npm publish` should be a last-resort recovery path, not the normal release process.

## Post-publish verification

```bash
npm view @fhajjej/loop-it name version bin
npx @fhajjej/loop-it@latest install --agent all --scope project --cwd /tmp/loop-it-npx-smoke
npx @fhajjej/loop-it@latest start --goal "Verify public launcher" --check "npm test" --agent all --force
```

After npm is live, make the product page use `npx @fhajjej/loop-it@latest install --agent all --scope project` as the primary command.
