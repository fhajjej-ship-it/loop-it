#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeBin = process.execPath;
const cliPath = resolve(repoRoot, "bin", "loop-it.mjs");
const tempRoot = mkdtempSync(resolve(tmpdir(), "loop-it-run-proof-"));
const projectDir = resolve(tempRoot, "repo");
const blockedProjectDir = resolve(tempRoot, "blocked-repo");
const isolatedProjectDir = resolve(tempRoot, "isolated-repo");
const isolatedWorktreeDir = resolve(tempRoot, "isolated-run-worktree");
const fakeCodex = resolve(tempRoot, "fake-codex.mjs");
const fakeCodexPass = resolve(tempRoot, "fake-codex-pass.mjs");
const fakeChecker = resolve(tempRoot, "fake-checker.mjs");
const fakeCheckerBlocker = resolve(tempRoot, "fake-checker-blocker.mjs");

try {
  createFailingFixture();
  expectFailure("npm", ["test"], "Expected fixture npm test to fail before Codex runs");
  createFakeCodex();
  createFakeCodexPass();
  createFakeChecker();
  createFakeCheckerBlocker();

  const executed = run(nodeBin, [
    cliPath,
    "run",
    "--from",
    "failing-ci-repair",
    "--goal",
    "Fix the failing npm test with the smallest safe change",
    "--check",
    "npm test",
    "--agent",
    "codex",
    "--execute",
    "codex",
    "--codex-bin",
    fakeCodex,
    "--codex-sandbox",
    "none",
    "--checker",
    "codex",
    "--checker-bin",
    fakeChecker,
    "--checker-sandbox",
    "none",
    "--max-iterations",
    "2",
    "--skip-git-repo-check",
  ], { cwd: projectDir });

  for (const text of [
    "Recommended loop: Failing CI repair (failing-ci-repair)",
    "Codex iteration 1/2",
    "Executing loop with Codex CLI:",
    "Running verifier after Codex iteration 1: npm test",
    "Verifier still failed after Codex iteration 1: npm test",
    "Continuing to iteration 2/2.",
    "Codex iteration 2/2",
    "Running verifier after Codex iteration 2: npm test",
    "Running read-only checker with Codex CLI.",
    "Checker passed.",
    "Verifier passed after Codex iteration 2: npm test",
    "Run proof:",
    "- Selected loop: Failing CI repair (failing-ci-repair)",
    "- Executor: Codex CLI",
    "- Verifier: npm test",
    "- Result: pass",
    "- Checker: pass (.loop-it/CODEX_CHECKER.md)",
    "- Iteration: 2/2",
    "- Progress: .loop-it/progress.json",
    "- Codex output: .loop-it/CODEX_FINAL.iteration-2.md",
  ]) {
    assertIncludes(executed.stdout, text, "run proof output");
  }

  run("npm", ["test"], { cwd: projectDir });
  assertFile(resolve(projectDir, ".loop-it", "CODEX_FINAL.md"));
  assertFile(resolve(projectDir, ".loop-it", "CODEX_FINAL.iteration-2.md"));
  assertFile(resolve(projectDir, ".loop-it", "CODEX_CHECKER.md"));

  const progress = JSON.parse(readFileSync(resolve(projectDir, ".loop-it", "progress.json"), "utf8"));
  if (
    progress.status !== "completed" ||
    progress.currentIteration !== 2 ||
    progress.lastResult !== "pass" ||
    progress.proof?.selectedLoopId !== "failing-ci-repair" ||
    progress.proof?.executor !== "codex" ||
    progress.proof?.verifier !== "npm test" ||
    progress.proof?.result !== "pass" ||
    progress.proof?.iteration !== 2 ||
    progress.proof?.maxIterations !== 2 ||
    progress.proof?.codexOutput !== ".loop-it/CODEX_FINAL.iteration-2.md" ||
    progress.lastCodexOutput !== ".loop-it/CODEX_FINAL.iteration-2.md" ||
    progress.lastChecker !== "pass" ||
    progress.lastCheckerOutput !== ".loop-it/CODEX_CHECKER.md" ||
    progress.proof?.checker?.result !== "pass" ||
    progress.proof?.checker?.outputPath !== ".loop-it/CODEX_CHECKER.md" ||
    progress.proof?.iterations?.length !== 2 ||
    progress.iterations?.length !== 2
  ) {
    fail("Expected progress.json to record completed two-pass run proof with checker receipt");
  }

  createFailingFixture(blockedProjectDir);
  expectFailure("npm", ["test"], "Expected blocked fixture npm test to fail before Codex runs", blockedProjectDir);
  const blocked = runExpectStatus(nodeBin, [
    cliPath,
    "run",
    "--from",
    "failing-ci-repair",
    "--goal",
    "Fix the failing npm test with the smallest safe change",
    "--check",
    "npm test",
    "--agent",
    "codex",
    "--execute",
    "codex",
    "--codex-bin",
    fakeCodexPass,
    "--codex-sandbox",
    "none",
    "--checker",
    "codex",
    "--checker-bin",
    fakeCheckerBlocker,
    "--checker-sandbox",
    "none",
    "--max-iterations",
    "1",
    "--skip-git-repo-check",
  ], { cwd: blockedProjectDir }, 2);
  assertIncludes(blocked.stdout, "Checker did not approve: Changed files lack regression coverage.", "checker blocker output");
  assertIncludes(blocked.stdout, "- Result: pass", "checker blocker run proof");
  assertIncludes(blocked.stdout, "- Checker: blocker (.loop-it/CODEX_CHECKER.md)", "checker blocker run proof");

  const blockedProgress = JSON.parse(readFileSync(resolve(blockedProjectDir, ".loop-it", "progress.json"), "utf8"));
  if (
    blockedProgress.status !== "blocked" ||
    blockedProgress.lastResult !== "checker-blocked" ||
    blockedProgress.proof?.result !== "checker-blocked" ||
    blockedProgress.proof?.checker?.result !== "blocker" ||
    blockedProgress.blockers?.[0] !== "Changed files lack regression coverage."
  ) {
    fail("Expected progress.json to record checker-blocked proof");
  }

  createFailingFixture(isolatedProjectDir);
  initGitRepo(isolatedProjectDir);
  expectFailure("npm", ["test"], "Expected isolated source fixture npm test to fail before Codex runs", isolatedProjectDir);
  const isolated = run(nodeBin, [
    cliPath,
    "run",
    "--from",
    "failing-ci-repair",
    "--goal",
    "Fix the isolated failing npm test with the smallest safe change",
    "--check",
    "npm test",
    "--agent",
    "codex",
    "--execute",
    "codex",
    "--codex-bin",
    fakeCodexPass,
    "--codex-sandbox",
    "none",
    "--max-iterations",
    "1",
    "--skip-git-repo-check",
    "--worktree",
    "--worktree-base",
    "HEAD",
    "--worktree-branch",
    "codex/loop-it-isolated-smoke",
    "--worktree-dir",
    isolatedWorktreeDir,
  ], { cwd: isolatedProjectDir });

  assertIncludes(isolated.stdout, `Worktree isolation: ${isolatedWorktreeDir}`, "worktree run output");
  assertIncludes(isolated.stdout, "Worktree branch: codex/loop-it-isolated-smoke", "worktree run output");
  assertIncludes(isolated.stdout, `- Worktree: ${isolatedWorktreeDir}`, "worktree proof output");
  run("npm", ["test"], { cwd: isolatedWorktreeDir });
  expectFailure("npm", ["test"], "Expected isolated source checkout to remain failing after worktree run", isolatedProjectDir);
  assertNotExists(resolve(isolatedProjectDir, ".loop-it"));

  const isolatedProgress = JSON.parse(readFileSync(resolve(isolatedWorktreeDir, ".loop-it", "progress.json"), "utf8"));
  if (
    isolatedProgress.status !== "completed" ||
    isolatedProgress.lastResult !== "pass" ||
    isolatedProgress.worktree?.path !== isolatedWorktreeDir ||
    isolatedProgress.worktree?.branch !== "codex/loop-it-isolated-smoke" ||
    isolatedProgress.proof?.worktree?.path !== isolatedWorktreeDir ||
    isolatedProgress.proof?.result !== "pass"
  ) {
    fail("Expected isolated run to record completed proof with worktree metadata");
  }

  console.log("Run proof smoke passed");
  console.log("Verified: failing fixture before run, selected loop, repeated fake Codex execution, verifier pass, checker pass/block, isolated worktree execution, and progress proof");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function createFailingFixture(targetDir = projectDir) {
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(
    resolve(targetDir, "package.json"),
    `${JSON.stringify(
      {
        name: "loop-it-run-proof-fixture",
        type: "module",
        scripts: {
          test: "node test.mjs",
        },
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  writeFileSync(
    resolve(targetDir, "test.mjs"),
    [
      "import assert from 'node:assert/strict';",
      "",
      "function subtotal(items) {",
      "  return items.reduce((sum, item) => sum + item.price, 0);",
      "}",
      "",
      "const total = subtotal([{ price: 1 }, { price: 1 }]);",
      "assert.equal(total, 3);",
      "",
    ].join("\n"),
    "utf8"
  );
}

function createFakeCodex() {
  writeFileSync(
    fakeCodex,
    [
      "#!/usr/bin/env node",
      "import { existsSync, readFileSync, writeFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "",
      "const testPath = resolve(process.cwd(), 'test.mjs');",
      "const countPath = resolve(process.cwd(), '.loop-it', 'fake-codex-count.txt');",
      "const count = existsSync(countPath) ? Number(readFileSync(countPath, 'utf8')) : 0;",
      "const nextCount = count + 1;",
      "writeFileSync(countPath, String(nextCount));",
      "const before = readFileSync(testPath, 'utf8');",
      "const afterFirstPass = before.replace('assert.equal(total, 3);', 'assert.equal(total, 4);');",
      "const afterSecondPass = before.replace('assert.equal(total, 4);', 'assert.equal(total, 2);').replace('assert.equal(total, 3);', 'assert.equal(total, 2);');",
      "writeFileSync(testPath, nextCount === 1 ? afterFirstPass : afterSecondPass);",
      "",
      "const outputIndex = process.argv.indexOf('--output-last-message');",
      "if (outputIndex !== -1 && process.argv[outputIndex + 1]) {",
      "  writeFileSync(resolve(process.cwd(), process.argv[outputIndex + 1]), `Fake Codex pass ${nextCount}\\n`);",
      "}",
      "",
    ].join("\n"),
    "utf8"
  );
  chmodSync(fakeCodex, 0o755);
}

function createFakeCodexPass() {
  writeFileSync(
    fakeCodexPass,
    [
      "#!/usr/bin/env node",
      "import { readFileSync, writeFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "",
      "const testPath = resolve(process.cwd(), 'test.mjs');",
      "const before = readFileSync(testPath, 'utf8');",
      "writeFileSync(testPath, before.replace('assert.equal(total, 3);', 'assert.equal(total, 2);'));",
      "",
      "const outputIndex = process.argv.indexOf('--output-last-message');",
      "if (outputIndex !== -1 && process.argv[outputIndex + 1]) {",
      "  writeFileSync(resolve(process.cwd(), process.argv[outputIndex + 1]), 'Fake Codex fixed the test.\\n');",
      "}",
      "",
    ].join("\n"),
    "utf8"
  );
  chmodSync(fakeCodexPass, 0o755);
}

function createFakeChecker() {
  writeFileSync(
    fakeChecker,
    [
      "#!/usr/bin/env node",
      "import { writeFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "",
      "const outputIndex = process.argv.indexOf('--output-last-message');",
      "if (outputIndex !== -1 && process.argv[outputIndex + 1]) {",
      "  writeFileSync(resolve(process.cwd(), process.argv[outputIndex + 1]), 'CHECKER_RESULT: pass\\nChecker reviewed the changed file, verifier proof, and Loop It state.\\n');",
      "}",
      "",
    ].join("\n"),
    "utf8"
  );
  chmodSync(fakeChecker, 0o755);
}

function createFakeCheckerBlocker() {
  writeFileSync(
    fakeCheckerBlocker,
    [
      "#!/usr/bin/env node",
      "import { writeFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "",
      "const outputIndex = process.argv.indexOf('--output-last-message');",
      "if (outputIndex !== -1 && process.argv[outputIndex + 1]) {",
      "  writeFileSync(resolve(process.cwd(), process.argv[outputIndex + 1]), 'CHECKER_RESULT: blocker\\nCHECKER_BLOCKER: Changed files lack regression coverage.\\n');",
      "}",
      "",
    ].join("\n"),
    "utf8"
  );
  chmodSync(fakeCheckerBlocker, 0o755);
}

function initGitRepo(targetDir) {
  run("git", ["init", "-b", "main"], { cwd: targetDir });
  run("git", ["add", "."], { cwd: targetDir });
  run("git", [
    "-c",
    "user.name=Loop It",
    "-c",
    "user.email=loop-it@example.com",
    "commit",
    "-m",
    "Initial fixture",
  ], { cwd: targetDir });
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    fail(
      [
        `Command failed: ${command} ${commandArgs.join(" ")}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return result;
}

function runExpectStatus(command, commandArgs, options, expectedStatus) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== expectedStatus) {
    fail(
      [
        `Expected command to exit ${expectedStatus}: ${command} ${commandArgs.join(" ")}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return result;
}

function expectFailure(command, commandArgs, message, cwd = projectDir) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status === 0) {
    fail(message);
  }
  assertIncludes(`${result.stdout}\n${result.stderr}`, "3", "initial failing fixture output");
}

function assertFile(path) {
  if (!existsSync(path)) {
    fail(`Expected file to exist: ${path}`);
  }
}

function assertNotExists(path) {
  if (existsSync(path)) {
    fail(`Expected path not to exist: ${path}`);
  }
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    fail(`Expected ${label} to include ${JSON.stringify(expected)}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
