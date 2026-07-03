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
const libraryEvalsPath = resolve(skillSource, "references", "library", "evals.json");
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
  smokeLoopRun();
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
    ".agents/skills/loop-it/references/library/evals.json",
    ".agents/skills/loop-it/scripts/select-loop.mjs",
    ".agents/skills/loop-it/scripts/create-loop.mjs",
    ".agents/skills/loop-it/scripts/start-loop.mjs",
    ".agents/skills/loop-it/scripts/run-loop.mjs",
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
  if (!Array.isArray(list.loops) || list.loops.length < 15) {
    fail("Expected bundled loop library to include at least 15 loops");
  }

  for (const loop of list.loops) {
    for (const field of ["requiredSignals", "goodExamples", "badExamples", "exampleChecks", "commonMisroutes"]) {
      if (!Array.isArray(loop[field]) || loop[field].length === 0) {
        fail(`Expected ${loop.id} to include non-empty ${field}`);
      }
    }
    assertReliabilityMetadata(loop);
    assertUserGuideMetadata(loop);
  }

  const search = JSON.parse(run(nodeBin, [cliPath, "library", "search", "failing ci", "--json"]).stdout);
  if (search.results?.[0]?.loop?.id !== "failing-ci-repair") {
    fail("Expected failing-ci-repair to be the top result for failing ci");
  }
  if (!["high", "medium"].includes(search.results?.[0]?.confidence)) {
    fail("Expected failing-ci-repair search to include usable confidence");
  }

  const recommendation = JSON.parse(
    run(nodeBin, [cliPath, "recommend", "--goal", "fix failing checkout test", "--json"]).stdout
  );
  if (recommendation.selected?.loop?.id !== "failing-ci-repair") {
    fail("Expected failing-ci-repair recommendation for a failing checkout test");
  }
  if (!recommendation.decision?.confidence || !Array.isArray(recommendation.decision?.whyNotAlternatives)) {
    fail("Expected recommendations to include decision confidence and alternative rationale");
  }
  const showOutput = run(nodeBin, [cliPath, "library", "show", "failing-ci-repair"]).stdout;
  for (const text of ["Plain English:", "Use when:", "Start with:", "First step:", "Proof tip:", "Not for:"]) {
    if (!showOutput.includes(text)) {
      fail(`Expected library show output to include ${JSON.stringify(text)}`);
    }
  }

  const evalReport = JSON.parse(run(nodeBin, [cliPath, "library", "eval", "--json"]).stdout);
  if (!evalReport.ok || evalReport.failed !== 0 || evalReport.missingLoopIds.length !== 0) {
    fail("Expected bundled library eval scenarios to pass and cover every loop");
  }

  for (const [goal, expectedLoopId] of [
    ["publish npm package", "release-readiness"],
    ["fix stale installed skill copies", "fresh-setup"],
    ["improve Loop It skill routing and examples", "skill-instruction-hardening"],
    ["evaluate Loop It recommendation quality", "product-evaluation"],
    ["sanitize unsafe user input", "security-hardening"],
    ["inspect this repo and run the right loop", "codebase-intake-to-running-loop"],
  ]) {
    assertRecommendedLoop(goal, expectedLoopId);
  }

  const evals = JSON.parse(readFileSync(libraryEvalsPath, "utf8"));
  const evalLoopIds = new Set();
  for (const scenario of evals.scenarios ?? []) {
    assertRecommendedLoop(scenario.goal, scenario.expectedLoopId);
    evalLoopIds.add(scenario.expectedLoopId);
  }
  for (const loop of list.loops) {
    if (!evalLoopIds.has(loop.id)) {
      fail(`Expected library eval scenarios to cover ${loop.id}`);
    }
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
    "Paste this into Codex as a normal message:",
    "Goal: Fix failing checkout tests",
    "Verifier: npm test -- checkout",
    "Iteration cap: 4",
    "the pasted launch prompt starts execution mode",
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
    "Use $loop-it if this Codex workspace has the Loop It skill or plugin enabled.",
    "If not, run the bounded task directly from this prompt.",
    "You are not being asked to create another loop.",
    "First action: run the verifier",
    "Changes only under .loop-it do not count as a successful iteration.",
    "Do not run loop-it write, loop-it new, or loop-it start.",
    "Use Claude Code `/loop` only for polling or interval work.",
    "Use /loop-it if this Cursor workspace has the Loop It skill installed.",
    "If nothing starts after pasting this",
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

function smokeLoopRun() {
  const projectDir = resolve(tempRoot, "loop-run-intake");
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(
    resolve(projectDir, "package.json"),
    JSON.stringify(
      {
        name: "loop-run-intake-fixture",
        scripts: {
          check: "node -e \"process.exit(0)\"",
          test: "node -e \"process.exit(0)\"",
        },
      },
      null,
      2
    )
  );

  const intake = run(nodeBin, [
    cliPath,
    "run",
    "--goal",
    "inspect this repo and run the right loop",
    "--agent",
    "codex",
  ], { cwd: projectDir });

  for (const text of [
    "Recommended loop: Codebase intake to running loop (codebase-intake-to-running-loop)",
    "Verifier: npm run check",
    "Preparing run-mode launch prompt",
    "Created .loop-it/LOOP.md",
    "Created .loop-it/progress.json",
    "Created .loop-it/LAUNCH.md",
  ]) {
    if (!intake.stdout.includes(text)) {
      fail(`Expected loop run output to include ${JSON.stringify(text)}`);
    }
  }

  const progressFile = resolve(projectDir, ".loop-it", "progress.json");
  const launchFile = resolve(projectDir, ".loop-it", "LAUNCH.md");
  assertFile(progressFile);
  assertFile(launchFile);

  const progress = JSON.parse(readFileSync(progressFile, "utf8"));
  if (progress.activeLoopId !== "codebase-intake-to-running-loop" || progress.verifier !== "npm run check") {
    fail("Expected intake run progress to track the selected loop and inferred check");
  }

  const launchContent = readFileSync(launchFile, "utf8");
  for (const text of [
    "Use $loop-it if this Codex workspace has the Loop It skill or plugin enabled.",
    "If not, run the bounded task directly from this prompt.",
    "You are not being asked to create another loop.",
    "First action: run the verifier",
    "Changes only under .loop-it do not count as a successful iteration.",
  ]) {
    if (!launchContent.includes(text)) {
      fail(`Expected run launch prompt to contain ${JSON.stringify(text)}`);
    }
  }

  const failingProjectDir = resolve(tempRoot, "loop-run-failing-test");
  mkdirSync(failingProjectDir, { recursive: true });
  writeFileSync(
    resolve(failingProjectDir, "package.json"),
    JSON.stringify(
      {
        name: "loop-run-failing-test-fixture",
        scripts: {
          test: "node test.mjs",
        },
      },
      null,
      2
    )
  );
  writeFileSync(
    resolve(failingProjectDir, "test.mjs"),
    [
      "import assert from 'node:assert/strict';",
      "",
      "assert.equal(1 + 1, 3);",
      "",
    ].join("\n")
  );
  const failing = run(nodeBin, [
    cliPath,
    "run",
    "--goal",
    "fix failing npm test with the smallest safe change",
    "--check",
    "npm test",
    "--agent",
    "codex",
  ], { cwd: failingProjectDir });

  for (const text of [
    "Recommended loop: Failing CI repair (failing-ci-repair)",
    "Verifier: npm test",
    "Preparing run-mode launch prompt",
    "Created .loop-it/LOOP.md",
    "Created .loop-it/progress.json",
    "Created .loop-it/LAUNCH.md",
  ]) {
    if (!failing.stdout.includes(text)) {
      fail(`Expected failing test run output to include ${JSON.stringify(text)}`);
    }
  }

  const failingLoopFile = resolve(failingProjectDir, ".loop-it", "LOOP.md");
  const failingProgressFile = resolve(failingProjectDir, ".loop-it", "progress.json");
  const failingLaunchFile = resolve(failingProjectDir, ".loop-it", "LAUNCH.md");
  assertFile(failingLoopFile);
  assertFile(failingProgressFile);
  assertFile(failingLaunchFile);

  const failingProgress = JSON.parse(readFileSync(failingProgressFile, "utf8"));
  if (
    failingProgress.activeLoopId !== "failing-ci-repair" ||
    failingProgress.status !== "ready" ||
    failingProgress.verifier !== "npm test" ||
    failingProgress.lastResult !== "not-run" ||
    failingProgress.recommendedNextAction !==
      "Paste a host launch prompt from .loop-it/LAUNCH.md into the target agent to run the repair; .loop-it-only changes do not count as progress."
  ) {
    fail("Expected failing test run progress to prepare execution without claiming completion");
  }

  const failingLoopContent = readFileSync(failingLoopFile, "utf8");
  for (const text of [
    "# Failing CI repair",
    "Command or criterion: npm test",
    "This file is the contract; it does not repair code until an agent runs the launch prompt.",
  ]) {
    if (!failingLoopContent.includes(text)) {
      fail(`Expected failing test loop contract to contain ${JSON.stringify(text)}`);
    }
  }

  const failingLaunchContent = readFileSync(failingLaunchFile, "utf8");
  for (const text of [
    "Use $loop-it if this Codex workspace has the Loop It skill or plugin enabled.",
    "If not, run the bounded task directly from this prompt.",
    "Read .loop-it/LOOP.md as state, then execute the repair.",
    "First action: run the verifier",
    "If the verifier fails, inspect the target repo, make the smallest credible change when needed, and rerun the verifier.",
    "Changes only under .loop-it do not count as a successful iteration. If you only updated loop files, keep going.",
    "After each iteration, run the verifier, record evidence in .loop-it/progress.json",
  ]) {
    if (!failingLaunchContent.includes(text)) {
      fail(`Expected failing test launch prompt to contain ${JSON.stringify(text)}`);
    }
  }

  const plan = JSON.parse(
    run(nodeBin, [
      cliPath,
      "run",
      "--goal",
      "inspect this repo and run the right loop",
      "--cwd",
      projectDir,
      "--json",
    ]).stdout
  );
  if (plan.selectedLoopId !== "codebase-intake-to-running-loop" || plan.check !== "npm run check") {
    fail("Expected run --json to report the selected intake loop and inferred check");
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
    ".agents/skills/loop-it/scripts/run-loop.mjs",
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

function assertRecommendedLoop(goal, expectedLoopId) {
  const recommendation = JSON.parse(run(nodeBin, [cliPath, "recommend", "--goal", goal, "--json"]).stdout);
  if (recommendation.selected?.loop?.id !== expectedLoopId) {
    fail(`Expected ${JSON.stringify(goal)} to recommend ${expectedLoopId}, got ${recommendation.selected?.loop?.id}`);
  }
  if (!recommendation.decision?.confidence || recommendation.decision.confidence === "low") {
    fail(`Expected ${JSON.stringify(goal)} to have non-low recommendation confidence`);
  }
}

function assertReliabilityMetadata(loop) {
  const metadata = loop.reliability;
  if (!metadata || typeof metadata !== "object") {
    fail(`Expected ${loop.id} to include reliability metadata`);
  }

  if (!["experimental", "tested", "proven"].includes(metadata.status)) {
    fail(`Expected ${loop.id} reliability.status to be experimental, tested, or proven`);
  }

  for (const field of ["summary", "requiredCheck"]) {
    if (typeof metadata[field] !== "string" || metadata[field].trim().length === 0) {
      fail(`Expected ${loop.id} reliability.${field} to be a non-empty string`);
    }
  }

  for (const field of ["bestWhen", "failsWhen"]) {
    if (!Array.isArray(metadata[field]) || metadata[field].length === 0) {
      fail(`Expected ${loop.id} reliability.${field} to be a non-empty array`);
    }
    for (const item of metadata[field]) {
      if (typeof item !== "string" || item.trim().length === 0) {
        fail(`Expected ${loop.id} reliability.${field} entries to be non-empty strings`);
      }
    }
  }

  if (metadata.status === "proven") {
    fail(`Expected ${loop.id} not to claim proven reliability without multi-repo eval evidence`);
  }
}

function assertUserGuideMetadata(loop) {
  const guide = loop.userGuide;
  if (!guide || typeof guide !== "object") {
    fail(`Expected ${loop.id} to include userGuide metadata`);
  }

  for (const field of ["plainLanguage", "useWhen", "starterRequest", "firstStep", "proofTip", "notFor"]) {
    if (typeof guide[field] !== "string" || guide[field].trim().length === 0) {
      fail(`Expected ${loop.id} userGuide.${field} to be a non-empty string`);
    }
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
