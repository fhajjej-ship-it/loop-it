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
const fakeCodex = resolve(tempRoot, "fake-codex.mjs");

try {
  createFailingFixture();
  expectFailure("npm", ["test"], "Expected fixture npm test to fail before Codex runs");
  createFakeCodex();

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
    "--skip-git-repo-check",
  ], { cwd: projectDir });

  for (const text of [
    "Recommended loop: Failing CI repair (failing-ci-repair)",
    "Executing loop with Codex CLI:",
    "Running verifier after Codex: npm test",
    "Verifier passed after Codex run: npm test",
    "Run proof:",
    "- Selected loop: Failing CI repair (failing-ci-repair)",
    "- Executor: Codex CLI",
    "- Verifier: npm test",
    "- Result: pass",
    "- Progress: .loop-it/progress.json",
    "- Codex output: .loop-it/CODEX_FINAL.md",
  ]) {
    assertIncludes(executed.stdout, text, "run proof output");
  }

  run("npm", ["test"], { cwd: projectDir });
  assertFile(resolve(projectDir, ".loop-it", "CODEX_FINAL.md"));

  const progress = JSON.parse(readFileSync(resolve(projectDir, ".loop-it", "progress.json"), "utf8"));
  if (
    progress.status !== "completed" ||
    progress.lastResult !== "pass" ||
    progress.proof?.selectedLoopId !== "failing-ci-repair" ||
    progress.proof?.executor !== "codex" ||
    progress.proof?.verifier !== "npm test" ||
    progress.proof?.result !== "pass" ||
    progress.proof?.codexOutput !== ".loop-it/CODEX_FINAL.md"
  ) {
    fail("Expected progress.json to record completed run proof");
  }

  console.log("Run proof smoke passed");
  console.log("Verified: failing fixture before run, selected loop, fake Codex execution, verifier pass, and progress proof");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function createFailingFixture() {
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(
    resolve(projectDir, "package.json"),
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
    resolve(projectDir, "test.mjs"),
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
      "import { readFileSync, writeFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "",
      "const testPath = resolve(process.cwd(), 'test.mjs');",
      "const before = readFileSync(testPath, 'utf8');",
      "writeFileSync(testPath, before.replace('assert.equal(total, 3);', 'assert.equal(total, 2);'));",
      "",
      "const outputIndex = process.argv.indexOf('--output-last-message');",
      "if (outputIndex !== -1 && process.argv[outputIndex + 1]) {",
      "  writeFileSync(resolve(process.cwd(), process.argv[outputIndex + 1]), 'Fake Codex fixed failing test\\n');",
      "}",
      "",
    ].join("\n"),
    "utf8"
  );
  chmodSync(fakeCodex, 0o755);
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

function expectFailure(command, commandArgs, message) {
  const result = spawnSync(command, commandArgs, {
    cwd: projectDir,
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

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    fail(`Expected ${label} to include ${JSON.stringify(expected)}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
