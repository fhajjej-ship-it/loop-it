#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const keep = args.has("--keep");
const runCodex = args.has("--codex-run") || process.env.LOOP_IT_PUBLIC_SMOKE_CODEX === "1";
const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const gitBin = process.platform === "win32" ? "git.exe" : "git";
const codexBin = process.platform === "win32" ? "codex.cmd" : "codex";
const packageSpec = "@fhajjej/loop-it@latest";
const tempRoot = mkdtempSync(resolve(tmpdir(), "loop-it-public-install-"));
const projectDir = resolve(tempRoot, "repo");
const launchOutput = resolve(projectDir, "codex-final.md");
let passed = false;

try {
  createFixture(projectDir);
  expectFailure(npmBin, ["test"], { cwd: projectDir }, "Expected fixture npm test to fail before Codex runs");

  run(npxBin, [
    "--yes",
    packageSpec,
    "install",
    "--agent",
    "codex",
    "--scope",
    "project",
    "--cwd",
    projectDir,
  ]);

  for (const target of [
    ".agents/skills/loop-it/SKILL.md",
    ".agents/skills/loop-it/references/library/loops.json",
    ".agents/skills/loop-it/scripts/start-loop.mjs",
    ".agents/skills/loop-it/scripts/run-loop.mjs",
  ]) {
    assertFile(resolve(projectDir, target));
  }

  const printedLaunch = run(npxBin, [
    "--yes",
    packageSpec,
    "start",
    "--from",
    "failing-ci-repair",
    "--goal",
    "Fix the failing npm test with the smallest safe change",
    "--check",
    "npm test",
    "--agent",
    "codex",
    "--print",
  ], { cwd: projectDir }).stdout;

  for (const text of [
    "Paste this into Codex as a normal message:",
    "Use $loop-it if this Codex workspace has the Loop It skill or plugin enabled.",
    "If not, run the bounded task directly from this prompt.",
    "Run The Loop mode. You are not being asked to create another loop.",
    "First action: run the verifier",
    "Changes only under .loop-it do not count as a successful iteration.",
    "If nothing starts after pasting this, send a follow-up message",
  ]) {
    assertIncludes(printedLaunch, text, "generated Codex launch prompt");
  }

  if (existsSync(resolve(projectDir, ".loop-it"))) {
    fail("Expected --print launch generation not to create .loop-it state");
  }

  if (runCodex) {
    runCodexProof();
  } else {
    console.log("Codex host run skipped. Use -- --codex-run to run the optional agent proof.");
  }

  console.log("Public install smoke passed");
  console.log(`Package: ${packageSpec}`);
  console.log("Verified: npm latest install, project skill files, and Codex run-now launch wording");
  if (runCodex) {
    console.log("Verified: optional Codex run fixed the failing fixture and npm test passed");
  }
  passed = true;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`Temporary project left for inspection: ${projectDir}`);
  process.exitCode = 1;
} finally {
  if (passed && !keep) {
    rmSync(tempRoot, { recursive: true, force: true });
  } else if (passed) {
    console.log(`Temporary project kept: ${projectDir}`);
  }
}

function createFixture(targetDir) {
  mkdirSync(targetDir, { recursive: true });
  run(gitBin, ["init", "--quiet"], { cwd: targetDir });
  writeFileSync(
    resolve(targetDir, "package.json"),
    `${JSON.stringify(
      {
        name: "loop-it-public-install-fixture",
        private: true,
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

function runCodexProof() {
  const startResult = run(npxBin, [
    "--yes",
    packageSpec,
    "start",
    "--from",
    "failing-ci-repair",
    "--goal",
    "Fix the failing npm test with the smallest safe change",
    "--check",
    "npm test",
    "--agent",
    "codex",
    "--force",
  ], { cwd: projectDir });

  const launchFile = resolve(projectDir, ".loop-it", "LAUNCH.md");
  assertFile(launchFile);
  assertIncludes(startResult.stdout, "Created .loop-it/LAUNCH.md", "public start output");

  const prompt = [
    "Run this public-install smoke fixture using the project-installed Loop It skill.",
    "Do not publish, deploy, or change files outside this temporary fixture.",
    "",
    readFileSync(launchFile, "utf8"),
  ].join("\n");

  run(codexBin, [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "--ignore-user-config",
    "--output-last-message",
    launchOutput,
    prompt,
  ], { cwd: projectDir, timeout: 180000 });

  run(npmBin, ["test"], { cwd: projectDir });
  assertFile(launchOutput);
}

function run(command, commandArgs, options = {}) {
  const env = { ...process.env };
  delete env.npm_config_dry_run;
  delete env.NPM_CONFIG_DRY_RUN;

  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? process.cwd(),
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 120000,
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

function expectFailure(command, commandArgs, options, message) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60000,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status === 0) {
    fail(message);
  }
  assertIncludes(`${result.stdout}\n${result.stderr}`, "2 !== 3", "initial failing fixture output");
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
  throw new Error(message);
}
