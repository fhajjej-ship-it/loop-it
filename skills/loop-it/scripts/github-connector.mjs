#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { findLoopById } from "./select-loop.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const scheduleScript = resolve(scriptDir, "schedule-loop.mjs");
const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));

if (!command || ["help", "--help", "-h"].includes(command) || args.help || args.h) {
  printUsage();
  process.exit(0);
}

if (command === "pr") {
  createPullRequestLoop(args);
} else {
  fail(`Unknown GitHub connector command: ${command}`);
}

function createPullRequestLoop(options) {
  const cwd = resolve(stringArg(options.cwd, process.cwd()));
  const repo = requiredString(options.repo, "--repo");
  const pr = requiredString(options.pr, "--pr");
  const execute = stringArg(options.execute, "codex");
  if (execute !== "codex") {
    fail("GitHub connector schedules are Codex-only. Pass --execute codex.");
  }
  const ghBin = stringArg(options["gh-bin"], "gh");
  const now = parseNow(options.now);
  const snapshot = readPullRequestSnapshot(cwd, ghBin, repo, pr);
  const selected = selectPullRequestLoop(snapshot, options);
  const loop = findLoopById(selected.loopId);
  if (!loop) {
    fail(`Selected loop is not in the library: ${selected.loopId}`);
  }

  const check = stringArg(options.check, defaultCheckFor(selected.loopId, ghBin, repo, pr));
  const goal = stringArg(
    options.goal,
    `Monitor GitHub PR ${repo}#${pr}, route review or CI changes into one bounded Codex loop, and stop before external writes.`
  );
  const id = scheduleId(options.id ?? `github-pr-${slug(repo)}-${pr}`);
  const connectorPath = resolve(cwd, ".loop-it", "connectors", "github", `${id}.json`);
  const target = stringArg(options.target, `github:${repo}#${pr}`);
  const record = {
    version: 1,
    id,
    connector: "github",
    kind: "pull-request",
    repo,
    pr: String(pr),
    target,
    selectedLoopId: loop.id,
    selectedLoopTitle: loop.title,
    reason: selected.reason,
    check,
    goal,
    snapshot,
    approvalGates: [
      "Do not comment on GitHub without explicit approval.",
      "Do not push commits without explicit approval.",
      "Do not request review, merge, deploy, publish, or change credentials without explicit approval.",
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  mkdirSync(dirname(connectorPath), { recursive: true });
  writeFileSync(connectorPath, JSON.stringify(record, null, 2) + "\n");

  const scheduleResult = options["no-schedule"]
    ? null
    : createSchedule(cwd, id, loop.id, goal, check, target, options, now);

  if (options.json) {
    printJson({
      ok: scheduleResult ? scheduleResult.status === 0 : true,
      connector: record,
      connectorPath,
      schedule: scheduleResult ? parseScheduleOutput(scheduleResult.stdout) : null,
      scheduleOutput: scheduleResult?.stdout ?? "",
      scheduleError: scheduleResult?.stderr ?? "",
    });
  } else {
    console.log(`GitHub PR connector: ${repo}#${pr}`);
    console.log(`Selected loop: ${loop.title} (${loop.id})`);
    console.log(`Reason: ${selected.reason}`);
    console.log(`Verifier: ${check}`);
    console.log(`Connector snapshot: ${relativePath(cwd, connectorPath)}`);
    if (scheduleResult) {
      process.stdout.write(scheduleResult.stdout);
      if (scheduleResult.stderr) {
        process.stderr.write(scheduleResult.stderr);
      }
    }
  }

  if (scheduleResult && scheduleResult.status !== 0) {
    process.exit(scheduleResult.status);
  }
}

function readPullRequestSnapshot(cwd, ghBin, repo, pr) {
  const result = spawnSync(
    ghBin,
    [
      "pr",
      "view",
      String(pr),
      "--repo",
      repo,
      "--json",
      [
        "number",
        "title",
        "state",
        "url",
        "author",
        "baseRefName",
        "headRefName",
        "mergeStateStatus",
        "reviewDecision",
        "statusCheckRollup",
        "reviews",
      ].join(","),
    ],
    {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  if (result.error) {
    fail(`Failed to run GitHub CLI (${ghBin}): ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(
      [
        `GitHub PR intake failed for ${repo}#${pr}.`,
        "Install/authenticate GitHub CLI or pass --gh-bin for tests.",
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`GitHub CLI returned non-JSON PR data: ${error.message}`);
  }
}

function selectPullRequestLoop(snapshot, options) {
  if (options.from) {
    return {
      loopId: options.from,
      reason: "manual loop override from --from",
    };
  }

  const reviewDecision = String(snapshot.reviewDecision ?? "").toUpperCase();
  if (reviewDecision === "CHANGES_REQUESTED") {
    return {
      loopId: "review-comment-resolver-routine",
      reason: "PR review decision is CHANGES_REQUESTED",
    };
  }

  if (hasFailedStatus(snapshot.statusCheckRollup) || isBlockedMergeState(snapshot.mergeStateStatus)) {
    return {
      loopId: "ci-health-watch",
      reason: "PR status checks or merge state need scheduled CI follow-up",
    };
  }

  return {
    loopId: "pr-review-watch",
    reason: "PR needs periodic review/CI observation without an immediate failure signal",
  };
}

function defaultCheckFor(loopId, ghBin, repo, pr) {
  const gh = shellArg(ghBin);
  const repoArg = shellArg(repo);
  const prArg = shellArg(pr);

  if (loopId === "ci-health-watch") {
    return `${gh} pr checks ${prArg} --repo ${repoArg} --fail-fast`;
  }

  if (loopId === "review-comment-resolver-routine") {
    return `test "$(${gh} pr view ${prArg} --repo ${repoArg} --json reviewDecision --jq .reviewDecision)" != "CHANGES_REQUESTED"`;
  }

  return `${gh} pr checks ${prArg} --repo ${repoArg} --fail-fast`;
}

function createSchedule(cwd, id, loopId, goal, check, target, options, now) {
  const scheduleArgs = [
    scheduleScript,
    "schedule",
    "--cwd",
    cwd,
    "--from",
    loopId,
    "--id",
    id,
    "--every",
    stringArg(options.every, "10m"),
    "--goal",
    goal,
    "--check",
    check,
    "--target",
    target,
    "--connector",
    "github",
    "--execute",
    "codex",
    "--checker",
    stringArg(options.checker, "codex"),
    "--now",
    now.toISOString(),
  ];

  for (const [source, targetFlag] of [
    ["heartbeat", "heartbeat"],
    ["heartbeat-id", "heartbeat-id"],
    ["heartbeat-name", "heartbeat-name"],
    ["heartbeat-status", "heartbeat-status"],
    ["heartbeat-model", "heartbeat-model"],
    ["heartbeat-reasoning-effort", "heartbeat-reasoning-effort"],
    ["heartbeat-rrule", "heartbeat-rrule"],
    ["heartbeat-command", "heartbeat-command"],
    ["codex-home", "codex-home"],
    ["max-iterations", "max-iterations"],
  ]) {
    if (options[source]) {
      scheduleArgs.push(`--${targetFlag}`, options[source]);
    }
  }
  for (const flag of ["force", "no-worktree"]) {
    if (options[flag]) {
      scheduleArgs.push(`--${flag}`);
    }
  }

  return spawnSync(process.execPath, scheduleArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function hasFailedStatus(value) {
  const text = JSON.stringify(value ?? {}).toUpperCase();
  return ["FAILURE", "FAILED", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"].some((token) =>
    text.includes(token)
  );
}

function isBlockedMergeState(value) {
  const state = String(value ?? "").toUpperCase();
  return ["BLOCKED", "DIRTY", "UNSTABLE"].includes(state);
}

function parseScheduleOutput(output) {
  const id = String(output).match(/^Created schedule:\s*(.+)$/m)?.[1] ?? null;
  return id ? { id } : null;
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
    if (["force", "help", "h", "json", "no-schedule", "no-worktree"].includes(key)) {
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

function scheduleId(value) {
  const id = slug(value);
  if (!id) {
    fail("Schedule id cannot be empty.");
  }
  return id;
}

function slug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shellArg(value) {
  return `'${String(value ?? "").replaceAll("'", "'\"'\"'")}'`;
}

function relativePath(cwd, path) {
  return path.startsWith(`${cwd}/`) ? path.slice(cwd.length + 1) : path;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printUsage() {
  console.log(`Usage:
  loop-it github pr --repo owner/repo --pr 123 --every 10m --execute codex --heartbeat codex

Commands:
  pr  Read a GitHub PR with gh, choose a PR/CI/review loop, and create a local schedule.

Options:
  --repo <owner/repo>          GitHub repository.
  --pr <number>               Pull request number.
  --every <30s|5m|1h|1d>      Interval between scheduled checks. Default: 10m.
  --execute codex             Required by the generated schedule.
  --heartbeat codex           Create/update a Codex Scheduled heartbeat.
  --checker <none|codex>      Persist a checker for scheduled Codex runs. Default: codex.
  --from <loop-id>            Override the selected loop.
  --check <command>           Override the generated verifier.
  --goal <text>               Override the generated goal.
  --target <text>             Override the connector target label.
  --gh-bin <path>             GitHub CLI executable. Default: gh.
  --codex-home <path>         Codex home for heartbeat files.
  --no-schedule               Only write the connector snapshot.
  --no-worktree               Run scheduled repairs in the current checkout.
  --force                     Replace an existing schedule.`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
