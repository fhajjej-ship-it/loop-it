#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeBin = process.execPath;
const cliPath = resolve(repoRoot, "bin", "loop-it.mjs");
const tempRoot = mkdtempSync(resolve(tmpdir(), "loop-it-smoke-"));

try {
  smokeProjectInstall();
  smokeLibrarySelection();
  smokeLoopFileCreation();
  smokePackedCli();
  console.log("Smoke install checks passed");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function smokeProjectInstall() {
  const projectDir = resolve(tempRoot, "project-install");
  mkdirSync(projectDir, { recursive: true });
  run(nodeBin, [cliPath, "install", "--agent", "all", "--scope", "project", "--cwd", projectDir]);

  for (const target of [
    ".agents/skills/loop-it/SKILL.md",
    ".claude/skills/loop-it/SKILL.md",
    ".cursor/skills/loop-it/SKILL.md",
    ".agents/skills/loop-it/references/loop-template.md",
    ".agents/skills/loop-it/references/library/loops.json",
    ".agents/skills/loop-it/scripts/select-loop.mjs",
    ".agents/skills/loop-it/scripts/create-loop.mjs",
  ]) {
    assertFile(resolve(projectDir, target));
  }

  const duplicate = spawnSync(nodeBin, [cliPath, "install", "--agent", "codex", "--scope", "project", "--cwd", projectDir], {
    encoding: "utf8",
  });
  if (duplicate.status === 0) {
    fail("Expected duplicate install without --force to fail");
  }

  run(nodeBin, [cliPath, "install", "--agent", "codex", "--scope", "project", "--cwd", projectDir, "--force"]);
}

function smokeLibrarySelection() {
  const list = JSON.parse(run(nodeBin, [cliPath, "library", "list", "--json"]).stdout);
  if (!Array.isArray(list.loops) || list.loops.length < 10) {
    fail("Expected bundled loop library to include at least 10 loops");
  }

  const search = JSON.parse(run(nodeBin, [cliPath, "library", "search", "failing ci", "--json"]).stdout);
  if (search.results?.[0]?.loop?.id !== "failing-ci-repair") {
    fail("Expected failing-ci-repair to be the top result for failing ci");
  }

  const recommendation = JSON.parse(
    run(nodeBin, [cliPath, "recommend", "--goal", "fix failing checkout test", "--json"]).stdout
  );
  if (recommendation.selected?.loop?.id !== "failing-ci-repair") {
    fail("Expected failing-ci-repair recommendation for a failing checkout test");
  }

  const projectDir = resolve(tempRoot, "next-from-progress");
  const loopDir = resolve(projectDir, ".loop-it");
  mkdirSync(loopDir, { recursive: true });
  writeFileSync(
    resolve(loopDir, "progress.json"),
    JSON.stringify(
      {
        activeLoopId: "release-readiness",
        loopName: "Release readiness",
        status: "active",
        objective: "Prepare a public package release",
        lastCheck: "npm run check",
        lastResult: "not-run",
        blockers: [],
        remainingRisks: [],
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  const next = JSON.parse(run(nodeBin, [cliPath, "next", "--cwd", projectDir, "--json"]).stdout);
  if (next.selected?.loop?.id !== "release-readiness") {
    fail("Expected next to continue the active release-readiness loop");
  }
}

function smokeLoopFileCreation() {
  const projectDir = resolve(tempRoot, "loop-file");
  mkdirSync(projectDir, { recursive: true });
  run(nodeBin, [
    cliPath,
    "new",
    "--name",
    "Docs sweep",
    "--objective",
    "Find stale setup docs",
    "--check",
    "npm test -- docs",
    "--max-iterations",
    "3",
  ], { cwd: projectDir });

  const loopFile = resolve(projectDir, ".loop-it", "LOOP.md");
  const progressFile = resolve(projectDir, ".loop-it", "progress.json");
  assertFile(loopFile);
  assertFile(progressFile);
  const content = readFileSync(loopFile, "utf8");
  for (const text of ["# Docs sweep", "Find stale setup docs", "npm test -- docs", "Max iterations: 3"]) {
    if (!content.includes(text)) {
      fail(`Expected ${loopFile} to contain ${JSON.stringify(text)}`);
    }
  }
  const progress = JSON.parse(readFileSync(progressFile, "utf8"));
  if (progress.loopName !== "Docs sweep" || progress.lastCheck !== "npm test -- docs") {
    fail("Expected progress.json to track the generated loop");
  }

  const libraryProjectDir = resolve(tempRoot, "library-loop-file");
  mkdirSync(libraryProjectDir, { recursive: true });
  run(nodeBin, [cliPath, "new", "--from", "failing-ci-repair"], { cwd: libraryProjectDir });
  const libraryLoopFile = resolve(libraryProjectDir, ".loop-it", "LOOP.md");
  const libraryProgressFile = resolve(libraryProjectDir, ".loop-it", "progress.json");
  assertFile(libraryLoopFile);
  assertFile(libraryProgressFile);
  const libraryContent = readFileSync(libraryLoopFile, "utf8");
  for (const text of ["# Failing CI repair", "Loop id: failing-ci-repair", "Fix the failing check"]) {
    if (!libraryContent.includes(text)) {
      fail(`Expected ${libraryLoopFile} to contain ${JSON.stringify(text)}`);
    }
  }
  const libraryProgress = JSON.parse(readFileSync(libraryProgressFile, "utf8"));
  if (libraryProgress.activeLoopId !== "failing-ci-repair") {
    fail("Expected library progress to track the loop id");
  }

  const duplicate = spawnSync(nodeBin, [cliPath, "new", "--name", "Duplicate", "--objective", "x", "--check", "y"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  if (duplicate.status === 0) {
    fail("Expected duplicate loop file creation without --force to fail");
  }
}

function smokePackedCli() {
  const packDir = resolve(tempRoot, "pack");
  const projectDir = resolve(tempRoot, "packed-project");
  mkdirSync(packDir, { recursive: true });
  mkdirSync(projectDir, { recursive: true });
  const pack = run("npm", ["pack", "--json", "--pack-destination", packDir, "--dry-run=false"], { cwd: repoRoot });
  const packageInfo = JSON.parse(pack.stdout);
  const tarballPath = resolve(packDir, packageInfo[0]?.filename ?? "");
  assertFile(tarballPath);

  run("npm", [
    "exec",
    "--yes",
    "--package",
    tarballPath,
    "--",
    "loop-it",
    "install",
    "--agent",
    "all",
    "--scope",
    "project",
    "--cwd",
    projectDir,
  ]);

  for (const target of [
    ".agents/skills/loop-it/SKILL.md",
    ".claude/skills/loop-it/SKILL.md",
    ".cursor/skills/loop-it/SKILL.md",
    ".agents/skills/loop-it/references/library/loops.json",
    ".agents/skills/loop-it/scripts/select-loop.mjs",
  ]) {
    assertFile(resolve(projectDir, target));
  }
}

function run(command, args, options = {}) {
  const env = { ...process.env };
  delete env.npm_config_dry_run;
  delete env.NPM_CONFIG_DRY_RUN;

  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    fail(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return result;
}

function assertFile(path) {
  if (!existsSync(path)) {
    fail(`Expected file to exist: ${path}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
