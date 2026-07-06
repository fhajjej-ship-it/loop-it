#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeBin = process.execPath;
const cliPath = resolve(repoRoot, "bin", "loop-it.mjs");
const tempRoot = mkdtempSync(resolve(tmpdir(), "loop-it-readiness-"));

try {
  smokeManualVerifierBlocksExecution();
  smokeApprovalWorkBlocksExecution();
  smokeReadyJsonPlan();
  console.log("Readiness preflight smoke passed");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function smokeManualVerifierBlocksExecution() {
  const projectDir = resolve(tempRoot, "manual-verifier");
  const fakeCodex = createFakeCodex(projectDir);
  mkdirSync(projectDir, { recursive: true });

  const result = expectFailure([
    "run",
    "--goal",
    "Improve this repo",
    "--execute",
    "codex",
    "--codex-bin",
    fakeCodex,
    "--codex-sandbox",
    "none",
    "--skip-git-repo-check",
  ], { cwd: projectDir });

  assertIncludes(result.stdout, "Readiness: ask-for-check", "manual readiness output");
  assertIncludes(result.stdout, "No automated verifier was found.", "manual readiness output");
  assertIncludes(result.stdout, "Loop It did not start Codex", "manual readiness output");
  assertNotExists(resolve(projectDir, ".loop-it"));
  assertNotExists(resolve(projectDir, "fake-codex-ran.txt"));
}

function smokeApprovalWorkBlocksExecution() {
  const projectDir = resolve(tempRoot, "approval-required");
  const fakeCodex = createFakeCodex(projectDir);
  mkdirSync(projectDir, { recursive: true });
  writePackage(projectDir, {
    name: "approval-required-fixture",
    type: "module",
    scripts: {
      check: "node check.mjs",
    },
  });
  writeFileSync(resolve(projectDir, "check.mjs"), "console.log('ok');\n", "utf8");

  const result = expectFailure([
    "run",
    "--goal",
    "Run npm publish for this package",
    "--check",
    "npm run check",
    "--execute",
    "codex",
    "--codex-bin",
    fakeCodex,
    "--codex-sandbox",
    "none",
    "--skip-git-repo-check",
  ], { cwd: projectDir });

  assertIncludes(result.stdout, "Readiness: approval-required", "approval readiness output");
  assertIncludes(result.stdout, "publishing", "approval readiness output");
  assertIncludes(result.stdout, "Loop It did not start Codex", "approval readiness output");
  assertNotExists(resolve(projectDir, ".loop-it"));
  assertNotExists(resolve(projectDir, "fake-codex-ran.txt"));
}

function smokeReadyJsonPlan() {
  const projectDir = resolve(tempRoot, "ready-plan");
  mkdirSync(projectDir, { recursive: true });
  writePackage(projectDir, {
    name: "ready-plan-fixture",
    type: "module",
    scripts: {
      test: "node test.mjs",
    },
  });
  writeFileSync(resolve(projectDir, "test.mjs"), "console.log('ok');\n", "utf8");

  const result = run([
    "run",
    "--goal",
    "Fix the failing checkout test",
    "--check",
    "npm test",
    "--execute",
    "codex",
    "--json",
  ], { cwd: projectDir });
  const plan = JSON.parse(result.stdout);

  if (plan.readiness?.action !== "run" || plan.readiness?.automatedVerifier !== true) {
    fail("Expected --json plan to report a runnable automated verifier");
  }
  if (plan.selectedLoopId !== "failing-ci-repair") {
    fail(`Expected failing-ci-repair, received ${plan.selectedLoopId}`);
  }
  assertNotExists(resolve(projectDir, ".loop-it"));
}

function createFakeCodex(projectDir) {
  const fakeCodex = resolve(projectDir, "fake-codex.mjs");
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(
    fakeCodex,
    [
      "#!/usr/bin/env node",
      "import { writeFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "writeFileSync(resolve(process.cwd(), 'fake-codex-ran.txt'), 'yes');",
      "",
    ].join("\n"),
    "utf8"
  );
  return fakeCodex;
}

function writePackage(projectDir, packageJson) {
  writeFileSync(resolve(projectDir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function run(commandArgs, options = {}) {
  const result = spawnSync(nodeBin, [cliPath, ...commandArgs], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    fail(commandFailure(commandArgs, result));
  }
  return result;
}

function expectFailure(commandArgs, options = {}) {
  const result = spawnSync(nodeBin, [cliPath, ...commandArgs], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status === 0) {
    fail(`Expected command to fail: loop-it ${commandArgs.join(" ")}`);
  }
  return result;
}

function commandFailure(commandArgs, result) {
  return [
    `Command failed: loop-it ${commandArgs.join(" ")}`,
    result.stdout.trim(),
    result.stderr.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    fail(`Expected ${label} to include ${JSON.stringify(expected)}`);
  }
}

function assertNotExists(path) {
  if (existsSync(path)) {
    fail(`Expected path not to exist: ${path}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
