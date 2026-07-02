#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
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

const plan = {
  goal,
  cwd,
  selectedLoopId: loop.id,
  selectedLoopTitle: loop.title,
  check,
  maxIterations: Number(maxIterations),
  agent,
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

process.exit(result.status ?? 1);

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

function parseArgs(tokens) {
  const parsed = { _: [] };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }

    const key = token.slice(2);
    if (["force", "json", "help", "h"].includes(key)) {
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
  --json                    Print the selected run plan without writing files
  --force                   Replace existing .loop-it files`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
