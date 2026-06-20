# Changelog

## 0.2.0

### Added

- Bundled loop library with curated coding loops for CI repair, bug fixes, docs, review repair, release readiness, setup, testing, UX, performance, dependencies, security, refactoring, and product evaluation.
- Offline loop selector CLI for listing, searching, recommending, and choosing the next loop from `.loop-it` progress.
- `loop-it new --from <loop-id>` for generating library-backed loop contracts.
- `.loop-it/progress.json` creation for machine-readable loop progress.

## 0.1.1

### Changed

- Renamed the npm package to `@fhajjej/loop-it` to comply with npm package-name similarity checks.
- Updated public install docs to use the scoped npm package.

## 0.1.0

Initial public release candidate.

### Added

- Portable `loop-it` Agent Skill for Codex, Claude Code, Cursor, and SKILL.md-compatible agents.
- Installer CLI for project and global skill installs.
- Durable `.loop-it/LOOP.md` generator.
- Codex plugin metadata.
- Installer smoke test for Codex, Claude Code, Cursor, loop-file creation, and packed-tarball execution.
- GitHub Actions checks and manual npm publish workflow.

### Release status

- GitHub release path is ready.
- npm package is prepared for scoped public publishing.
