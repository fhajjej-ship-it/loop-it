#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { findLoopById, recommendLoop } from "./select-loop.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const startScript = resolve(scriptDir, "start-loop.mjs");

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printUsage();
  process.exit(0);
}

const cwd = resolve(stringArg(args.cwd, process.cwd()));
const goal = stringArg(
  args.goal ?? args._.join(" "),
  "Find the highest-confidence actionable issue in this repository, recommend the right Loop It loop, and run it."
);
const repo = inspectRepository(cwd);
const loop = selectLoop(args, goal, repo);
const check = stringArg(args.check, inferCheck(goal, repo));
const maxIterations = stringArg(args["max-iterations"], loop.maxIterations ?? "3");
const agent = stringArg(args.agent, "codex");
const execute = stringArg(args.execute, "none");

if (!["none", "codex"].includes(execute)) {
  fail(`Unsupported --execute value: ${execute}`);
}
if (execute === "codex" && !["codex", "all"].includes(agent)) {
  fail("--execute codex requires --agent codex or --agent all");
}

const plan = {
  goal,
  cwd,
  selectedLoopId: loop.id,
  selectedLoopTitle: loop.title,
  check,
  maxIterations: Number(maxIterations),
  agent,
  execute,
  repoSignals: repo,
};

if (args.json) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

console.log(`Recommended loop: ${loop.title} (${loop.id})`);
console.log(`Goal: ${goal}`);
console.log(`Verifier: ${check}`);
if (repo.summary.length) {
  console.log(`Repo signals: ${repo.summary.join(", ")}`);
}
console.log("");
console.log("Preparing run-mode launch prompt...");

const startArgs = [
  startScript,
  "--from",
  loop.id,
  "--goal",
  goal,
  "--check",
  check,
  "--agent",
  agent,
  "--max-iterations",
  maxIterations,
];

if (args.force) {
  startArgs.push("--force");
}

const result = spawnSync(process.execPath, startArgs, {
  cwd,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (execute === "codex") {
  executeWithCodex({
    cwd,
    goal,
    check,
    loop,
    maxIterations,
  });
}

process.exit(0);

function executeWithCodex(run) {
  const launchPath = resolve(run.cwd, ".loop-it", "LAUNCH.md");
  const outputPath = resolve(run.cwd, stringArg(args["codex-output"], ".loop-it/CODEX_FINAL.md"));
  const codexBin = stringArg(args["codex-bin"], "codex");
  const sandbox = stringArg(args["codex-sandbox"], "workspace-write");

  if (!existsSync(launchPath)) {
    fail(`Expected launch file to exist before execution: ${launchPath}`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  const launch = readFileSync(launchPath, "utf8");
  const prompt = [
    "Run this Loop It contract now.",
    `Selected loop: ${run.loop.title} (${run.loop.id})`,
    `Goal: ${run.goal}`,
    `Verifier: ${run.check}`,
    `Iteration cap: ${run.maxIterations}`,
    "",
    launch,
  ].join("\n");

  const codexArgs = ["exec"];
  if (args["skip-git-repo-check"]) {
    codexArgs.push("--skip-git-repo-check");
  }
  if (args["codex-ignore-user-config"]) {
    codexArgs.push("--ignore-user-config");
  }
  if (sandbox !== "none") {
    codexArgs.push("--sandbox", sandbox);
  }
  codexArgs.push("--output-last-message", outputPath, prompt);

  console.log("");
  console.log(`Executing loop with Codex CLI: ${codexBin} ${codexArgs.slice(0, -1).join(" ")}`);
  const codexResult = spawnSync(codexBin, codexArgs, {
    cwd: run.cwd,
    stdio: "inherit",
  });

  if (codexResult.error) {
    updateProgress(run.cwd, {
      status: "blocked",
      lastResult: "blocked",
      blockers: [`Codex execution failed: ${codexResult.error.message}`],
      recommendedNextAction: "Install or authenticate Codex CLI, then rerun loop-it run --execute codex.",
    });
    fail(`Codex execution failed: ${codexResult.error.message}`);
  }

  if (codexResult.status !== 0) {
    updateProgress(run.cwd, {
      status: "blocked",
      lastResult: "blocked",
      blockers: [`Codex CLI exited ${codexResult.status ?? 1}`],
      recommendedNextAction: `Inspect ${relativeToCwd(run.cwd, outputPath)} and rerun the loop after resolving the blocker.`,
    });
    process.exit(codexResult.status ?? 1);
  }

  verifyAfterCodex(run.cwd, run.check, outputPath);
}

function verifyAfterCodex(cwd, check, codexOutputPath) {
  if (isManualCheck(check)) {
    updateProgress(cwd, {
      status: "blocked",
      currentIteration: 1,
      lastCheck: check,
      lastResult: "manual-verification-required",
      blockers: ["Verifier is manual, so Loop It cannot prove completion automatically."],
      remainingRisks: ["Run the manual verifier before calling this loop complete."],
      recommendedNextAction: `Run the manual verifier and record the result in .loop-it/progress.json. Codex output: ${relativeToCwd(cwd, codexOutputPath)}`,
      changedFiles: changedFiles(cwd),
    });
    console.log("");
    console.log(`Manual verifier required: ${check}`);
    process.exit(2);
  }

  console.log("");
  console.log(`Running verifier after Codex: ${check}`);
  const verifier = spawnSync(check, {
    cwd,
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [verifier.stdout, verifier.stderr].filter(Boolean).join("\n").trim();

  if (verifier.status === 0) {
    updateProgress(cwd, {
      status: "completed",
      currentIteration: 1,
      lastCheck: check,
      lastResult: "pass",
      lastVerifierOutput: truncate(output),
      blockers: [],
      remainingRisks: [],
      recommendedNextAction: "Stop; verifier passed after Codex execution.",
      changedFiles: changedFiles(cwd),
    });
    if (output) {
      console.log(output);
    }
    console.log(`Verifier passed after Codex run: ${check}`);
    return;
  }

  updateProgress(cwd, {
    status: "active",
    currentIteration: 1,
    lastCheck: check,
    lastResult: "failed",
    lastVerifierOutput: truncate(output),
    blockers: [],
    remainingRisks: [`Verifier still fails: ${check}`],
    recommendedNextAction: "Inspect the verifier output and rerun the loop only if the next pass has a clear expected improvement.",
    changedFiles: changedFiles(cwd),
  });
  if (output) {
    console.error(output);
  }
  fail(`Verifier still failed after Codex run: ${check}`);
}

function selectLoop(args, goal, repo) {
  if (args.from) {
    const loop = findLoopById(args.from);
    if (!loop) {
      fail(`Unknown loop id: ${args.from}`);
    }
    return loop;
  }

  if (isIntakeGoal(goal, repo)) {
    return requiredLoop("codebase-intake-to-running-loop");
  }

  const recommendation = recommendLoop({ goal: routingGoal(goal, repo) });
  return recommendation.selected?.loop ?? requiredLoop("codebase-intake-to-running-loop");
}

function requiredLoop(id) {
  const loop = findLoopById(id);
  if (!loop) {
    fail(`Missing bundled loop: ${id}`);
  }
  return loop;
}

function inspectRepository(cwd) {
  const packageJsonPath = resolve(cwd, "package.json");
  const packageJson = existsSync(packageJsonPath) ? readJson(packageJsonPath) : null;
  const scripts = packageJson?.scripts && typeof packageJson.scripts === "object" ? Object.keys(packageJson.scripts) : [];
  const files = [
    [".github/workflows", "github-actions"],
    ["tsconfig.json", "typescript"],
    ["next.config.js", "nextjs"],
    ["next.config.mjs", "nextjs"],
    ["vite.config.js", "vite"],
    ["vite.config.ts", "vite"],
    ["package-lock.json", "npm-lockfile"],
    ["pnpm-lock.yaml", "pnpm-lockfile"],
    ["yarn.lock", "yarn-lockfile"],
  ]
    .filter(([file]) => existsSync(resolve(cwd, file)))
    .map(([, label]) => label);

  const summary = [];
  if (packageJson?.name) {
    summary.push(`package ${packageJson.name}`);
  }
  if (scripts.length) {
    summary.push(`scripts ${scripts.slice(0, 6).join("/")}`);
  }
  summary.push(...files);

  return {
    hasPackageJson: Boolean(packageJson),
    scripts,
    files,
    summary,
  };
}

function inferCheck(goal, repo) {
  const scripts = new Set(repo.scripts);
  const loweredGoal = goal.toLowerCase();
  const npm = (script) => (script === "test" ? "npm test" : `npm run ${script}`);

  for (const [pattern, script] of [
    [/\b(lint|eslint)\b/, "lint"],
    [/\b(typecheck|type-check|tsc|types)\b/, "typecheck"],
    [/\b(test|spec|failing)\b/, "test"],
    [/\b(build|compile)\b/, "build"],
    [/\b(ci|check|verify)\b/, "check"],
  ]) {
    if (pattern.test(loweredGoal) && scripts.has(script)) {
      return npm(script);
    }
  }

  for (const script of ["check", "test", "lint", "typecheck", "build"]) {
    if (scripts.has(script)) {
      return npm(script);
    }
  }

  return "Manual verification: inspect the changed files and run the narrowest project-specific check available.";
}

function routingGoal(goal, repo) {
  return [
    goal,
    repo.scripts.length ? `Available package scripts: ${repo.scripts.join(", ")}` : "",
    repo.files.length ? `Repository signals: ${repo.files.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function isIntakeGoal(goal, repo) {
  const loweredGoal = goal.toLowerCase();
  const intakePhrases = [
    "find the highest-confidence actionable issue",
    "find next issue",
    "what should i tackle next",
    "what should we tackle next",
    "inspect this repo",
    "inspect this codebase",
    "improve this repo",
    "improve this codebase",
    "run the right loop",
  ];
  return intakePhrases.some((phrase) => loweredGoal.includes(phrase)) || (!args.check && !repo.scripts.length);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function updateProgress(cwd, patch) {
  const progressPath = resolve(cwd, ".loop-it", "progress.json");
  if (!existsSync(progressPath)) {
    return;
  }

  const current = readJson(progressPath);
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(progressPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function changedFiles(cwd) {
  const result = spawnSync("git", ["status", "--short"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isManualCheck(value) {
  return /^manual verification\b/i.test(value.trim());
}

function relativeToCwd(cwd, path) {
  const normalizedCwd = resolve(cwd);
  const normalizedPath = resolve(path);
  if (normalizedPath.startsWith(`${normalizedCwd}/`)) {
    return normalizedPath.slice(normalizedCwd.length + 1);
  }
  return normalizedPath;
}

function truncate(value, maxLength = 4000) {
  if (!value || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n... truncated ...`;
}

function parseArgs(tokens) {
  const parsed = { _: [] };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }

    const key = token.slice(2);
    if (["force", "json", "skip-git-repo-check", "codex-ignore-user-config", "help", "h"].includes(key)) {
      parsed[key] = true;
      continue;
    }

    const value = tokens[i + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for --${key}`);
    }
    parsed[key] = value;
    i += 1;
  }
  return parsed;
}

function stringArg(value, fallback) {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }
  return value.trim();
}

function printUsage() {
  console.log(`Usage:
  run-loop.mjs --goal "Fix failing checkout tests" --check "npm test -- checkout"
  run-loop.mjs --goal "Improve this repo" --agent codex

Options:
  --goal <text>             User objective to route into a loop
  --check <text>            Verifier command or objective success criterion
  --from <loop-id>          Force a bundled loop id
  --agent <codex|claude|cursor|all>  Host launch prompt to generate, default codex
  --cwd <path>              Repository root, default current working directory
  --max-iterations <n>      Iteration cap, default selected loop cap
  --execute <none|codex>    Execute the generated loop with Codex CLI, default none
  --codex-bin <path>        Codex executable for --execute codex, default codex
  --codex-sandbox <mode>    Codex sandbox mode, default workspace-write; use none to omit
  --codex-output <path>     Last Codex message path, default .loop-it/CODEX_FINAL.md
  --codex-ignore-user-config  Pass --ignore-user-config to codex exec
  --skip-git-repo-check     Pass --skip-git-repo-check to codex exec
  --json                    Print the selected run plan without writing files
  --force                   Replace existing .loop-it files`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
