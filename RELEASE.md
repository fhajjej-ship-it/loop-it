# Release checklist

Use this checklist before publishing `@fhajjej/loop-it`. GitHub is the release source of truth; npm is published by GitHub Actions from a GitHub Release.

## Source of truth

- Start every release branch from current `main`.
- Keep `main` as the canonical source for package code, skill files, plugin manifests, docs, and release notes.
- Publish by creating a GitHub Release whose tag matches `package.json`, for example `v0.3.6`.
- Treat npm as downstream of GitHub Actions. Do not update npm first unless the GitHub workflow is unavailable and this checklist's manual fallback is being used.
- Treat local Codex, Claude Code, Cursor, and plugin installs as generated artifacts. Update source files in this repo first, then regenerate or reinstall local copies from the repo/package.

## Preconditions

- Confirm the scoped package name is available or owned by this project:

```bash
npm view @fhajjej/loop-it name version
```

- Add `NPM_TOKEN` to GitHub Actions secrets before creating a release:
  - Create a granular npm automation token with publish access for `@fhajjej/loop-it`.
  - Add it in GitHub under `Settings` -> `Secrets and variables` -> `Actions` -> `Repository secrets`.
  - Name the secret exactly `NPM_TOKEN`.
  - Do not commit, print, or paste the token into repo files, release notes, terminal logs, or chat.
- Confirm the working tree is clean except intentional release changes.

## Local checks

```bash
npm run check
npm run smoke:public-install
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

The public install smoke creates a temporary clean project, installs `@fhajjej/loop-it@latest` from npm, verifies the project Codex skill files, and checks the generated Codex launch prompt for the run-now fallback wording. It does not require Codex auth by default.

## Publish

GitHub publish:

1. Commit and push the release changes to `main`.
2. Create a GitHub release whose tag matches `package.json`, for example `v0.3.6`.
3. Let the `Publish` workflow validate the tag, confirm whether the version already exists on npm, verify `NPM_TOKEN` before expensive checks for unpublished versions, run `npm run check`, and publish to npm.

Manual fallback:

Use the `Publish` workflow's manual dispatch from GitHub Actions after fixing `NPM_TOKEN`. Local `npm publish --access public --auth-type=web` should be a last-resort recovery path, not the normal release process.

## Post-publish verification

```bash
npm view @fhajjej/loop-it name version bin
npm run smoke:public-install
npm run smoke:public-codex -- --keep
npm run sync:codex-plugin
codex plugin list | grep 'loop-it@personal'
```

Use `npm run smoke:public-codex -- --keep` only on a local machine with Codex CLI auth. It installs the public package in a temporary fixture, runs `loop-it run --execute codex`, asks Codex to fix a tiny failing `npm test`, reruns the verifier, and checks `.loop-it/progress.json` for completed proof. `--keep` preserves the fixture for inspection.

After npm is live, update the Swarmix product page at
`/experiments/loop-it-poc` before treating the release as complete. The page
must use `npx @fhajjej/loop-it@latest install --agent all --scope project` as
the primary install command, show the current package version, describe the
current runner behavior, and keep the portfolio consumer dependency aligned
with the published npm version.

After the product page is aligned, refresh the local Codex plugin with
`npm run sync:codex-plugin` so `loop-it@personal` in Codex points at the same
version as the GitHub/npm release.
