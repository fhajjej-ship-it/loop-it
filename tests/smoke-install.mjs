#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillSource = resolve(repoRoot, "skills", "loop-it");
const nodeBin = process.execPath;
const cliPath = resolve(repoRoot, "bin", "loop-it.mjs");
const tempRoot = mkdtempSync(resolve(tmpdir(), "loop-it-smoke-"));

try {
  smokePackageMetadata();
  smokeProjectInstall();
  smokeLibrarySelection();
  smokeLoopFileCreation();
  smokeLoopWriting();
  smokeLoopStart();
  smokePackedCli();
  console.log("Smoke install checks passed");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function smokePackageMetadata() {
  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  for (const file of [
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
    ".cursor-plugin/plugin.json",
  ]) {
    const metadata = JSON.parse(readFileSync(resolve(repoRoot, file), "utf8"));
    if (metadata.version !== packageJson.version) {
      fail(`Expected ${file} version ${metadata.version} to match package.json version ${packageJson.version}`);
    }
  }
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
    ".agents/skills/loop-it/scripts/start-loop.mjs",
  ]) {
    assertFile(resolve(projectDir, target));
  }

  for (const target of [
    ".agents/skills/loop-it",
    ".claude/skills/loop-it",
    ".cursor/skills/loop-it",
  ]) {
    assertDirectoryMatches(skillSource, resolve(projectDir, target));
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

  const blockedProjectDir = resolve(tempRoot, "next-from-blocked-progress");
  writeProgress(blockedProjectDir, {
    activeLoopId: "failing-ci-repair",
    loopName: "Failing CI repair",
    status: "blocked",
    objective: "Fix the failing checkout test",
    lastCheck: "npm test -- checkout",
    lastResult: "blocked",
    blockers: ["Need regression coverage before more code changes"],
    remainingRisks: ["Checkout edge case lacks focused tests"],
    recommendedNextAction: "Add focused test coverage around the checkout regression",
  });
  const blockedNext = JSON.parse(run(nodeBin, [cliPath, "next", "--cwd", blockedProjectDir, "--json"]).stdout);
  if (blockedNext.selected?.loop?.id !== "test-coverage-gap") {
    fail("Expected blocked progress to recommend test-coverage-gap");
  }
  if (blockedNext.selected?.loop?.id === "failing-ci-repair") {
    fail("Expected blocked progress not to continue the blocked active loop");
  }
  if (!blockedNext.workflow?.write?.startsWith("loop-it write --from test-coverage-gap")) {
    fail("Expected blocked progress recommendation to include the next loop write workflow");
  }
  if (!blockedNext.workflow?.start?.startsWith("loop-it start --from test-coverage-gap")) {
    fail("Expected blocked progress recommendation to include the next loop launch workflow");
  }

  const completedProjectDir = resolve(tempRoot, "next-from-completed-progress");
  writeProgress(completedProjectDir, {
    activeLoopId: "release-readiness",
    loopName: "Release readiness",
    status: "completed",
    objective: "Prepare package release",
    lastCheck: "npm run check",
    lastResult: "pass",
    blockers: [],
    remainingRisks: ["Setup docs may be stale after release"],
    recommendedNextAction: "Run a docs sweep for setup commands and examples",
  });
  const completedNext = JSON.parse(run(nodeBin, [cliPath, "next", "--cwd", completedProjectDir, "--json"]).stdout);
  if (completedNext.selected?.loop?.id !== "docs-sweep") {
    fail("Expected completed progress to recommend docs-sweep");
  }
  if (completedNext.selected?.loop?.id === "release-readiness") {
    fail("Expected completed progress not to continue the completed active loop");
  }
}

function smokeLoopFileCreation() {
  const projectDir = resolve(tempRoot, "loop-file");
  mkdirSync(projectDir, { recursive: true });
  const created = run(nodeBin, [
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
  for (const text of ["Created .loop-it/LOOP.md", "Created .loop-it/progress.json"]) {
    if (!created.stdout.includes(text)) {
      fail(`Expected loop creation output to include ${JSON.stringify(text)}`);
    }
  }

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

function smokeLoopWriting() {
  const projectDir = resolve(tempRoot, "loop-write");
  mkdirSync(projectDir, { recursive: true });
  const written = run(nodeBin, [
    cliPath,
    "write",
    "--goal",
    "Fix failing checkout tests",
    "--check",
    "npm test -- checkout",
    "--max-iterations",
    "4",
  ], { cwd: projectDir });

  for (const text of ["Created .loop-it/LOOP.md", "Created .loop-it/progress.json"]) {
    if (!written.stdout.includes(text)) {
      fail(`Expected loop write output to include ${JSON.stringify(text)}`);
    }
  }

  const loopFile = resolve(projectDir, ".loop-it", "LOOP.md");
  const progressFile = resolve(projectDir, ".loop-it", "progress.json");
  assertFile(loopFile);
  assertFile(progressFile);

  const content = readFileSync(loopFile, "utf8");
  for (const text of ["Fix failing checkout tests", "npm test -- checkout", "Max iterations: 4"]) {
    if (!content.includes(text)) {
      fail(`Expected ${loopFile} to contain ${JSON.stringify(text)}`);
    }
  }

  const progress = JSON.parse(readFileSync(progressFile, "utf8"));
  if (progress.objective !== "Fix failing checkout tests" || progress.lastCheck !== "npm test -- checkout") {
    fail("Expected progress.json to track the written loop goal and verifier");
  }

  const missingCheck = spawnSync(nodeBin, [cliPath, "write", "--goal", "Missing verifier"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  if (missingCheck.status === 0 || !missingCheck.stderr.includes("--check is required")) {
    fail("Expected loop write without --check to fail clearly");
  }
}

function smokeLoopStart() {
  const projectDir = resolve(tempRoot, "loop-start");
  mkdirSync(projectDir, { recursive: true });
  const started = run(nodeBin, [
    cliPath,
    "start",
    "--goal",
    "Fix failing checkout tests",
    "--check",
    "npm test -- checkout",
    "--agent",
    "all",
    "--max-iterations",
    "4",
  ], { cwd: projectDir });

  for (const text of [
    "Created .loop-it/LOOP.md",
    "Created .loop-it/progress.json",
    "Created .loop-it/LAUNCH.md",
    "## Codex Launch",
    "## Claude Code Launch",
    "## Cursor Launch",
    "/goal Fix failing checkout tests",
    "Verifier: npm test -- checkout",
    "Iteration cap: 4",
  ]) {
    if (!started.stdout.includes(text)) {
      fail(`Expected loop start output to include ${JSON.stringify(text)}`);
    }
  }

  const loopFile = resolve(projectDir, ".loop-it", "LOOP.md");
  const launchFile = resolve(projectDir, ".loop-it", "LAUNCH.md");
  const progressFile = resolve(projectDir, ".loop-it", "progress.json");
  assertFile(loopFile);
  assertFile(launchFile);
  assertFile(progressFile);

  const launchContent = readFileSync(launchFile, "utf8");
  for (const text of [
    "Protocol: DISCOVER -> PLAN -> EXECUTE -> VERIFY -> ITERATE.",
    "Use Claude Code `/loop` only for polling or interval work.",
    "Cursor does not provide the same native finish-line `/goal` primitive here",
  ]) {
    if (!launchContent.includes(text)) {
      fail(`Expected ${launchFile} to contain ${JSON.stringify(text)}`);
    }
  }

  const progress = JSON.parse(readFileSync(progressFile, "utf8"));
  if (progress.status !== "ready" || progress.verifier !== "npm test -- checkout" || progress.maxIterations !== 4) {
    fail("Expected progress.json to track the started loop launcher contract");
  }

  const missingCheck = spawnSync(nodeBin, [cliPath, "start", "--goal", "Missing verifier"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  if (missingCheck.status === 0 || !missingCheck.stderr.includes("--check is required")) {
    fail("Expected loop start without --check to fail clearly");
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

  run("npm", [
    "exec",
    "--yes",
    "--package",
    tarballPath,
    "--",
    "loop-it",
    "start",
    "--goal",
    "Verify packed launcher",
    "--check",
    "npm test",
    "--agent",
    "codex",
    "--force",
  ], { cwd: projectDir });

  for (const target of [
    ".agents/skills/loop-it/SKILL.md",
    ".claude/skills/loop-it/SKILL.md",
    ".cursor/skills/loop-it/SKILL.md",
    ".agents/skills/loop-it/references/library/loops.json",
    ".agents/skills/loop-it/scripts/select-loop.mjs",
    ".agents/skills/loop-it/scripts/start-loop.mjs",
    ".loop-it/LOOP.md",
    ".loop-it/LAUNCH.md",
  ]) {
    assertFile(resolve(projectDir, target));
  }

  for (const target of [
    ".agents/skills/loop-it",
    ".claude/skills/loop-it",
    ".cursor/skills/loop-it",
  ]) {
    assertDirectoryMatches(skillSource, resolve(projectDir, target));
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

function assertDirectoryMatches(sourceDir, targetDir) {
  const sourceFiles = relativeFileList(sourceDir);
  const targetFiles = relativeFileList(targetDir);
  if (JSON.stringify(sourceFiles) !== JSON.stringify(targetFiles)) {
    fail(`Expected ${targetDir} to contain the same files as ${sourceDir}`);
  }

  for (const file of sourceFiles) {
    const sourceBytes = readFileSync(resolve(sourceDir, file));
    const targetBytes = readFileSync(resolve(targetDir, file));
    if (Buffer.compare(sourceBytes, targetBytes) !== 0) {
      fail(`Expected ${resolve(targetDir, file)} to match ${resolve(sourceDir, file)}`);
    }
  }
}

function relativeFileList(rootDir) {
  const files = [];
  collectFiles(rootDir, "", files);
  return files.sort();
}

function collectFiles(rootDir, relativeDir, files) {
  const currentDir = resolve(rootDir, relativeDir);
  for (const entry of readdirSync(currentDir).sort()) {
    const relativePath = relativeDir ? `${relativeDir}/${entry}` : entry;
    const fullPath = resolve(rootDir, relativePath);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectFiles(rootDir, relativePath, files);
    } else if (stat.isFile()) {
      files.push(relativePath);
    }
  }
}

function writeProgress(projectDir, progress) {
  const loopDir = resolve(projectDir, ".loop-it");
  mkdirSync(loopDir, { recursive: true });
  writeFileSync(resolve(loopDir, "progress.json"), JSON.stringify(progress, null, 2));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
