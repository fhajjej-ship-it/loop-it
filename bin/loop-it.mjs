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
  runCreateLoop(argv);
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

function runCreateLoop(args) {
  const script = resolve(skillSource, "scripts", "create-loop.mjs");
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
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
  loop-it new --name "Docs sweep" --objective "Update stale docs" --check "npm test"

Commands:
  install   Copy the loop-it skill into Codex, Claude Code, and/or Cursor skill folders.
  new       Create a .loop-it/LOOP.md loop contract in the current directory.

Install options:
  --agent <codex|claude|cursor|all>  Default: all
  --scope <project|global>           Default: project
  --cwd <path>                       Project root for project installs
  --force                            Replace an existing installed skill`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
