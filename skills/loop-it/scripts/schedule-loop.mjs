#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { findLoopById } from "./select-loop.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const runScript = resolve(scriptDir, "run-loop.mjs");
const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));

if (!command || ["help", "--help", "-h"].includes(command) || args.help || args.h) {
  printUsage();
  process.exit(0);
}

if (command === "schedule") {
  schedule(args);
} else if (command === "tick") {
  tick(args);
} else {
  fail(`Unknown schedule command: ${command}`);
}

function schedule(options) {
  const cwd = resolve(stringArg(options.cwd, process.cwd()));
  const loopId = requiredString(options.from, "--from");
  const loop = findLoopById(loopId);
  if (!loop) {
    fail(`Unknown loop id: ${loopId}`);
  }
  if (!["time-based", "proactive"].includes(loop.loopType)) {
    fail(`Scheduled execution is only for time-based or proactive loops. ${loop.id} is ${loop.loopType}.`);
  }

  const execute = stringArg(options.execute, "none");
  if (execute !== "codex") {
    fail("Scheduled Loop It execution is Codex-only. Pass --execute codex.");
  }

  const every = requiredString(options.every, "--every");
  const everyMs = parseDurationMs(every);
  const id = scheduleId(options.id ?? loop.id);
  const now = parseNow(options.now);
  const schedulePath = resolve(scheduleDir(cwd), `${id}.json`);
  if (existsSync(schedulePath) && !options.force) {
    fail(`${schedulePath} already exists. Re-run with --force to replace it.`);
  }

  const goal = stringArg(options.goal, loop.defaultObjective);
  const check = stringArg(options.check, loop.defaultCheck);
  const record = {
    version: 1,
    id,
    status: "active",
    loopId: loop.id,
    loopTitle: loop.title,
    loopType: loop.loopType,
    connector: stringArg(options.connector, "command"),
    target: stringArg(options.target, ""),
    goal,
    check,
    every,
    everyMs,
    execute: "codex",
    agent: "codex",
    maxIterations: positiveInteger(stringArg(options["max-iterations"], loop.maxIterations ?? "3"), "--max-iterations"),
    worktree: !options["no-worktree"],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    nextRunAt: stringArg(options["next-run-at"], now.toISOString()),
    lastRunAt: null,
    lastResult: "not-run",
    runCount: 0,
  };

  mkdirSync(dirname(schedulePath), { recursive: true });
  writeFileSync(schedulePath, JSON.stringify(record, null, 2) + "\n");

  if (options.json) {
    printJson({ ok: true, schedule: record, path: schedulePath });
    return;
  }

  console.log(`Created schedule: ${id}`);
  console.log(`Loop: ${record.loopTitle} (${record.loopId})`);
  console.log(`Every: ${record.every}`);
  console.log(`Next run: ${record.nextRunAt}`);
  console.log(`Execute: ${record.execute}`);
  console.log(`Worktree: ${record.worktree ? "enabled" : "disabled"}`);
}

function tick(options) {
  const cwd = resolve(stringArg(options.cwd, process.cwd()));
  const execute = stringArg(options.execute, "none");
  if (execute !== "codex") {
    fail("Scheduled ticks are Codex-only. Pass --execute codex.");
  }
  if (!options.all && !options.id) {
    fail("Pass --all to tick all due schedules or --id <schedule-id>.");
  }

  const now = parseNow(options.now);
  const schedules = loadSchedules(cwd).filter((record) => {
    if (options.id && record.id !== options.id) {
      return false;
    }
    return options.id || options.all;
  });

  const due = schedules.filter((record) => isDue(record, now));
  if (due.length === 0) {
    const result = { ok: true, now: now.toISOString(), due: 0, results: [] };
    if (options.json) {
      printJson(result);
    } else {
      console.log("No due schedules.");
    }
    return;
  }

  const results = [];
  for (const record of due) {
    const result = tickOne(cwd, record, now, options);
    results.push(result);
  }

  const ok = results.every((result) => ["pass", "skipped", "locked"].includes(result.result));
  if (options.json) {
    printJson({ ok, now: now.toISOString(), due: due.length, results });
  }
  if (!ok) {
    process.exitCode = 1;
  }
}

function tickOne(cwd, record, now, options) {
  const lockPath = resolve(scheduleDir(cwd), `${record.id}.lock`);
  if (!acquireLock(lockPath, record, now)) {
    if (!options.json) {
      console.log(`Skipping locked schedule: ${record.id}`);
    }
    return { id: record.id, result: "locked", reason: "lock file exists" };
  }

  try {
    if (!options.json) {
      console.log(`Ticking schedule: ${record.id}`);
      console.log(`Loop: ${record.loopTitle} (${record.loopId})`);
      console.log(`Check: ${record.check}`);
    }

    const precheck = runCheck(cwd, record.check);
    if (precheck.status === 0) {
      const updated = updateSchedule(cwd, record, now, {
        lastResult: "pass",
        lastOutputSummary: truncate(precheck.output),
      });
      writeScheduleProgress(cwd, updated, {
        status: "completed",
        lastResult: "pass",
        outputSummary: truncate(precheck.output),
        nextAction: `Wait until ${updated.nextRunAt} for the next scheduled tick.`,
        proof: {
          scheduleId: updated.id,
          selectedLoopId: updated.loopId,
          selectedLoopTitle: updated.loopTitle,
          executor: "loop-it tick",
          verifier: updated.check,
          result: "pass",
          tickedAt: now.toISOString(),
          nextRunAt: updated.nextRunAt,
        },
      });
      if (!options.json) {
        console.log(`Scheduled check passed: ${record.check}`);
        console.log(`Next run: ${updated.nextRunAt}`);
      }
      return { id: record.id, result: "pass", checkStatus: 0, nextRunAt: updated.nextRunAt };
    }

    if (!options.json) {
      console.log(`Scheduled check failed before Codex execution: ${record.check}`);
      if (precheck.output) {
        console.log(truncate(precheck.output, 1200));
      }
    }

    const execution = runCodexLoop(cwd, record, options);
    const progress = readProgress(cwd);
    const runResult = execution.status === 0 ? progress?.lastResult ?? "pass" : "failed";
    const updated = updateSchedule(cwd, record, now, {
      lastResult: runResult,
      lastOutputSummary: truncate([execution.stdout, execution.stderr].filter(Boolean).join("\n")),
    });
    annotateProgress(cwd, updated, {
      tickedAt: now.toISOString(),
      precheckStatus: precheck.status,
      precheckOutput: truncate(precheck.output),
      runStatus: execution.status,
      nextRunAt: updated.nextRunAt,
    });
    if (!options.json) {
      console.log(`Scheduled Codex run result: ${runResult}`);
      console.log(`Next run: ${updated.nextRunAt}`);
    }
    return {
      id: record.id,
      result: runResult,
      checkStatus: precheck.status,
      runStatus: execution.status,
      nextRunAt: updated.nextRunAt,
    };
  } finally {
    rmSync(lockPath, { force: true });
  }
}

function runCodexLoop(cwd, record, options) {
  const runArgs = [
    runScript,
    "--from",
    record.loopId,
    "--goal",
    record.goal,
    "--check",
    record.check,
    "--agent",
    "codex",
    "--execute",
    "codex",
    "--max-iterations",
    String(record.maxIterations),
    "--force",
  ];

  if (record.worktree) {
    runArgs.push("--worktree");
  }
  for (const [source, target] of [
    ["codex-bin", "codex-bin"],
    ["codex-sandbox", "codex-sandbox"],
    ["codex-output", "codex-output"],
    ["checker", "checker"],
    ["checker-bin", "checker-bin"],
    ["checker-sandbox", "checker-sandbox"],
    ["checker-output", "checker-output"],
    ["worktree-base", "worktree-base"],
    ["worktree-branch", "worktree-branch"],
    ["worktree-dir", "worktree-dir"],
  ]) {
    if (options[source]) {
      runArgs.push(`--${target}`, options[source]);
    }
  }
  for (const flag of ["skip-git-repo-check", "codex-ignore-user-config"]) {
    if (options[flag]) {
      runArgs.push(`--${flag}`);
    }
  }

  const result = spawnSync(process.execPath, runArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    return {
      status: 1,
      stdout: result.stdout ?? "",
      stderr: `Failed to run scheduled Codex loop: ${result.error.message}`,
    };
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runCheck(cwd, check) {
  const result = spawnSync(check, {
    cwd,
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status ?? 1,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
  };
}

function loadSchedules(cwd) {
  const dir = scheduleDir(cwd);
  if (!existsSync(dir)) {
    return [];
  }
  return readdirJson(dir)
    .map((path) => JSON.parse(readFileSync(path, "utf8")))
    .filter((record) => record && record.version === 1);
}

function readdirJson(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => resolve(dir, name));
}

function updateSchedule(cwd, record, now, patch) {
  const updated = {
    ...record,
    ...patch,
    runCount: Number(record.runCount ?? 0) + 1,
    lastRunAt: now.toISOString(),
    updatedAt: now.toISOString(),
    nextRunAt: new Date(now.getTime() + Number(record.everyMs)).toISOString(),
  };
  writeSchedule(cwd, updated);
  return updated;
}

function writeSchedule(cwd, record) {
  const path = resolve(scheduleDir(cwd), `${record.id}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n");
}

function writeScheduleProgress(cwd, record, patch) {
  const progressPath = resolve(cwd, ".loop-it", "progress.json");
  mkdirSync(dirname(progressPath), { recursive: true });
  const progress = {
    activeLoopId: record.loopId,
    loopName: record.loopTitle,
    scheduleId: record.id,
    status: patch.status,
    objective: record.goal,
    verifier: record.check,
    lastCheck: record.check,
    lastResult: patch.lastResult,
    lastExecutor: "loop-it tick",
    blockers: patch.lastResult === "pass" ? [] : [`Scheduled tick did not complete: ${patch.lastResult}`],
    remainingRisks: [],
    recommendedNextAction: patch.nextAction,
    updatedAt: new Date().toISOString(),
    proof: patch.proof,
  };
  writeFileSync(progressPath, JSON.stringify(progress, null, 2) + "\n");
}

function annotateProgress(cwd, record, scheduleProof) {
  const progressPath = resolve(cwd, ".loop-it", "progress.json");
  if (!existsSync(progressPath)) {
    writeScheduleProgress(cwd, record, {
      status: scheduleProof.runStatus === 0 ? "completed" : "blocked",
      lastResult: scheduleProof.runStatus === 0 ? "pass" : "failed",
      nextAction: `Wait until ${record.nextRunAt} for the next scheduled tick.`,
      proof: {
        scheduleId: record.id,
        selectedLoopId: record.loopId,
        selectedLoopTitle: record.loopTitle,
        executor: "loop-it tick",
        verifier: record.check,
        result: scheduleProof.runStatus === 0 ? "pass" : "failed",
        ...scheduleProof,
      },
    });
    return;
  }

  const progress = JSON.parse(readFileSync(progressPath, "utf8"));
  const proof = {
    ...(progress.proof ?? {}),
    schedule: {
      scheduleId: record.id,
      connector: record.connector,
      target: record.target,
      ...scheduleProof,
    },
  };
  writeFileSync(
    progressPath,
    JSON.stringify(
      {
        ...progress,
        scheduleId: record.id,
        scheduledLoopId: record.loopId,
        scheduledNextRunAt: record.nextRunAt,
        updatedAt: new Date().toISOString(),
        proof,
      },
      null,
      2
    ) + "\n"
  );
}

function readProgress(cwd) {
  const progressPath = resolve(cwd, ".loop-it", "progress.json");
  if (!existsSync(progressPath)) {
    return null;
  }
  return JSON.parse(readFileSync(progressPath, "utf8"));
}

function acquireLock(lockPath, record, now) {
  try {
    writeFileSync(
      lockPath,
      JSON.stringify(
        {
          scheduleId: record.id,
          pid: process.pid,
          createdAt: now.toISOString(),
        },
        null,
        2
      ) + "\n",
      { flag: "wx" }
    );
    return true;
  } catch {
    return false;
  }
}

function isDue(record, now) {
  if (record.status !== "active") {
    return false;
  }
  const dueAt = new Date(record.nextRunAt);
  return Number.isFinite(dueAt.getTime()) && dueAt.getTime() <= now.getTime();
}

function scheduleDir(cwd) {
  return resolve(cwd, ".loop-it", "schedules");
}

function parseDurationMs(value) {
  const match = String(value ?? "").trim().match(/^(\d+)(s|m|h|d)$/i);
  if (!match) {
    fail(`Invalid --every value: ${value}. Use values like 30s, 5m, 1h, or 1d.`);
  }
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multiplier = unit === "s" ? 1000 : unit === "m" ? 60000 : unit === "h" ? 3600000 : 86400000;
  return amount * multiplier;
}

function parseNow(value) {
  if (!value) {
    return new Date();
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    fail(`Invalid timestamp: ${value}`);
  }
  return date;
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
    if (["all", "force", "help", "h", "json", "no-worktree", "skip-git-repo-check", "codex-ignore-user-config"].includes(key)) {
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

function requiredString(value, name) {
  const text = stringArg(value, "");
  if (!text) {
    fail(`${name} is required.`);
  }
  return text;
}

function stringArg(value, fallback) {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }
  return value.trim();
}

function positiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`${name} must be a positive integer.`);
  }
  return parsed;
}

function scheduleId(value) {
  const id = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!id) {
    fail("Schedule id cannot be empty.");
  }
  return id;
}

function truncate(value, max = 2000) {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printUsage() {
  console.log(`Usage:
  loop-it schedule --from ci-health-watch --every 10m --check "npm run check" --execute codex
  loop-it tick --all --execute codex

Commands:
  schedule  Create or replace a .loop-it/schedules/<id>.json record.
  tick      Run due schedules once. Use cron, launchd, GitHub Actions, or a Codex automation to call this.

Schedule options:
  --from <loop-id>             Time-based or proactive library loop id.
  --every <30s|5m|1h|1d>       Interval between ticks.
  --check <command>            Command that proves current state or fails before Codex repairs.
  --goal <text>                Scheduled goal, default selected loop objective.
  --target <text>              Optional PR, branch, URL, queue, or other target label.
  --id <id>                    Schedule id, default selected loop id.
  --execute codex              Required. Scheduled execution is Codex-only.
  --no-worktree                Run in the current checkout instead of an isolated worktree.
  --force                      Replace existing schedule.

Tick options:
  --all                        Tick every due schedule.
  --id <id>                    Tick one due schedule.
  --execute codex              Required. Scheduled execution is Codex-only.
  --now <iso>                  Override current time for tests.
  --codex-bin <path>           Codex executable override.
  --codex-sandbox <mode>       Codex sandbox override.
  --skip-git-repo-check        Forward to Codex execution.`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
