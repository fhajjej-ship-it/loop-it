#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillSource = resolve(root, "skills", "loop-it");
const argv = process.argv.slice(2);
const command = argv.shift();

if (!command || ["help", "--help", "-h"].includes(command)) {
  printUsage();
  process.exit(0);
}

if (command === "install") {
  install(parseArgs(argv));
} else if (command === "new") {
  runSkillScript("create-loop.mjs", argv);
} else if (command === "write") {
  runSkillScript("create-loop.mjs", ["--require-fields", ...argv]);
} else if (command === "start") {
  runSkillScript("start-loop.mjs", argv);
} else if (command === "run") {
  runSkillScript("run-loop.mjs", argv);
} else if (command === "doctor") {
  runSkillScript("doctor.mjs", argv);
} else if (command === "schedule") {
  runSkillScript("schedule-loop.mjs", ["schedule", ...argv]);
} else if (command === "schedules") {
  runSkillScript("schedule-loop.mjs", argv.length > 0 ? argv : ["list"]);
} else if (command === "tick") {
  runSkillScript("schedule-loop.mjs", ["tick", ...argv]);
} else if (command === "github") {
  runSkillScript("github-connector.mjs", argv);
} else if (command === "library") {
  runSkillScript("select-loop.mjs", argv);
} else if (command === "recommend") {
  runSkillScript("select-loop.mjs", ["recommend", ...argv]);
} else if (command === "next") {
  runSkillScript("select-loop.mjs", ["next", ...argv]);
} else {
  fail(`Unknown command: ${command}`);
}

function install(args) {
  const agent = stringArg(args.agent, "all");
  const scope = stringArg(args.scope, "project");
  const cwd = resolve(stringArg(args.cwd, process.cwd()));
  const agents = agent === "all" ? ["codex", "claude", "cursor"] : [agent];

  for (const name of agents) {
    const target = targetFor(name, scope, cwd);
    if (!target) {
      fail(`Unsupported agent: ${name}`);
    }

    if (existsSync(target)) {
      if (!args.force) {
        fail(`${target} already exists. Re-run with --force to replace it.`);
      }
      rmSync(target, { recursive: true, force: true });
    }

    mkdirSync(dirname(target), { recursive: true });
    cpSync(skillSource, target, { recursive: true });
    console.log(`Installed loop-it for ${name} at ${target}`);
  }
}

function targetFor(agent, scope, cwd) {
  const base =
    scope === "global"
      ? {
          codex: resolve(homedir(), ".agents", "skills"),
          claude: resolve(homedir(), ".claude", "skills"),
          cursor: resolve(homedir(), ".cursor", "skills"),
        }
      : scope === "project"
        ? {
            codex: resolve(cwd, ".agents", "skills"),
            claude: resolve(cwd, ".claude", "skills"),
            cursor: resolve(cwd, ".cursor", "skills"),
          }
        : null;

  return base?.[agent] ? resolve(base[agent], "loop-it") : null;
}

function runSkillScript(scriptName, args) {
  const script = resolve(skillSource, "scripts", scriptName);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  if (result.error) {
    fail(`Failed to run ${scriptName}: ${result.error.message}`);
  }
  process.exit(result.status ?? 1);
}

function parseArgs(tokens) {
  const parsed = {};
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("--")) {
      fail(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (["force"].includes(key)) {
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
  loop-it install --agent all --scope project
  loop-it install --agent codex --scope global
  loop-it write --goal "Fix failing checkout tests" --check "npm test -- checkout"
  loop-it run --goal "Fix failing checkout tests" --check "npm test -- checkout" --execute codex
  loop-it run --goal "Fix failing CI" --check "npm run check" --execute codex --checker codex --worktree
  loop-it doctor
  loop-it schedule --from ci-health-watch --every 10m --check "npm run check" --execute codex --heartbeat codex
  loop-it schedules list
  loop-it github pr --repo owner/repo --pr 123 --every 10m --execute codex --heartbeat codex
  loop-it tick --all --execute codex
  loop-it start --goal "Fix failing checkout tests" --check "npm test -- checkout" --agent codex
  loop-it new --name "Docs sweep" --objective "Update stale docs" --check "npm test"
  loop-it new --from failing-ci-repair
  loop-it library list
  loop-it library search "failing ci"
  loop-it library eval
  loop-it recommend --goal "fix failing checkout test"
  loop-it next --cwd .

Commands:
  install   Copy the loop-it skill into Codex, Claude Code, and/or Cursor skill folders.
  write     Write a verifier-gated .loop-it/LOOP.md contract.
  run       Inspect repo signals, recommend a loop, prepare a launch prompt, and optionally execute it.
  doctor    Explain package, plugin, schedule, heartbeat, Codex CLI, and GitHub connector readiness.
  schedule  Create a Codex-only time/proactive schedule and optionally its Codex Scheduled heartbeat.
  schedules List, pause, or resume local Loop It schedules.
  github    Create GitHub-backed loop schedules from PR status, review, and CI signals.
  tick      Run due schedules once with Codex execution.
  start     Compile a goal, verifier, stop rules, and host launch prompt.
  new       Create a .loop-it/LOOP.md loop contract in the current directory.
  library   List, search, or show bundled loops.
  recommend Select a loop from a goal.
  next      Select what to loop next from .loop-it progress.

Install options:
  --agent <codex|claude|cursor|all>  Default: all
  --scope <project|global>           Default: project
  --cwd <path>                       Project root for project installs
  --force                            Replace an existing installed skill

Run execution options:
  --execute codex                    Call Codex CLI and rerun the verifier after each pass
  --checker codex                    Run a second read-only checker after the verifier passes
  --worktree                         Create a fresh git worktree/branch and run Codex there`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
