#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..", "..", "..");
const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printUsage();
  process.exit(0);
}

const report = buildDoctorReport(args);
if (args.json) {
  printJson(report);
} else {
  printHuman(report);
}

if (!report.ok) {
  process.exitCode = 1;
}

function buildDoctorReport(options) {
  const cwd = resolve(stringArg(options.cwd, process.cwd()));
  const codexHome = resolve(stringArg(options["codex-home"], process.env.CODEX_HOME || resolve(homedir(), ".codex")));
  const packageInfo = readPackageInfo();
  const npmLatest = options["skip-npm-latest"]
    ? { status: "skipped", version: null, detail: "Skipped by --skip-npm-latest." }
    : readNpmLatest(options);
  const plugin = readPersonalPlugin(codexHome);
  const projectSkill = {
    exists: existsSync(resolve(cwd, ".agents", "skills", "loop-it", "SKILL.md")),
    path: resolve(cwd, ".agents", "skills", "loop-it"),
  };
  const schedules = loadSchedules(cwd);
  const githubConnectorCount = countJsonFiles(resolve(cwd, ".loop-it", "connectors", "github"));
  const githubRequired = githubConnectorCount > 0 || schedules.some((schedule) => schedule.connector === "github");
  const codexCli = checkCommand(stringArg(options["codex-bin"], "codex"), ["--version"]);
  const githubCli = githubRequired || options["check-gh"]
    ? checkCommand(stringArg(options["gh-bin"], "gh"), ["auth", "status"])
    : { status: "not-required", ok: true, output: "", detail: "No GitHub connector state found." };

  const issues = collectIssues({
    packageInfo,
    npmLatest,
    plugin,
    schedules,
    codexCli,
    githubRequired,
    githubCli,
  });
  const status = issues[0]?.code ?? "ready";
  const ok = !issues.some((issue) => issue.severity === "blocker");

  return {
    ok,
    status,
    cwd,
    package: packageInfo,
    npm: npmLatest,
    codex: {
      home: codexHome,
      plugin,
      projectSkill,
      cli: codexCli,
    },
    schedules: {
      count: schedules.length,
      records: schedules,
    },
    github: {
      required: githubRequired,
      connectorCount: githubConnectorCount,
      cli: githubCli,
    },
    issues,
    nextAction: nextAction(status),
  };
}

function readPackageInfo() {
  const path = resolve(packageRoot, "package.json");
  if (!existsSync(path)) {
    return {
      status: "unknown",
      name: "@fhajjej/loop-it",
      version: null,
      path,
      detail: "package.json was not found next to the Loop It CLI.",
    };
  }

  const metadata = JSON.parse(readFileSync(path, "utf8"));
  return {
    status: "found",
    name: metadata.name ?? "@fhajjej/loop-it",
    version: metadata.version ?? null,
    path,
  };
}

function readNpmLatest(options) {
  const npmBin = stringArg(options["npm-bin"], "npm");
  const result = spawnSync(npmBin, ["view", "@fhajjej/loop-it", "version"], {
    encoding: "utf8",
    timeout: positiveInteger(stringArg(options.timeout, "5000"), "--timeout"),
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    return {
      status: "unknown",
      version: null,
      detail: result.error.message,
    };
  }
  if (result.status !== 0) {
    return {
      status: "unknown",
      version: null,
      detail: truncate([result.stdout, result.stderr].filter(Boolean).join("\n")),
    };
  }
  return {
    status: "found",
    version: String(result.stdout ?? "").trim().split(/\s+/).filter(Boolean).at(-1) ?? null,
  };
}

function readPersonalPlugin(codexHome) {
  const cacheDir = resolve(codexHome, "plugins", "cache", "personal", "loop-it");
  if (!existsSync(cacheDir)) {
    return {
      status: "missing",
      version: null,
      path: cacheDir,
      detail: "No personal Loop It plugin cache found.",
    };
  }

  const candidates = readdirSync(cacheDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metadataPath = resolve(cacheDir, entry.name, ".codex-plugin", "plugin.json");
      if (!existsSync(metadataPath)) {
        return null;
      }
      const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
      return {
        status: "found",
        version: metadata.version ?? entry.name,
        path: metadataPath,
      };
    })
    .filter(Boolean)
    .sort((a, b) => compareVersions(b.version, a.version));

  return candidates[0] ?? {
    status: "missing",
    version: null,
    path: cacheDir,
    detail: "Loop It plugin cache exists but no plugin metadata was found.",
  };
}

function loadSchedules(cwd) {
  const dir = resolve(cwd, ".loop-it", "schedules");
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const path = resolve(dir, name);
      const record = JSON.parse(readFileSync(path, "utf8"));
      return {
        id: record.id,
        status: record.status,
        loopId: record.loopId,
        loopType: record.loopType,
        connector: record.connector ?? "command",
        target: record.target ?? "",
        check: record.check,
        every: record.every,
        nextRunAt: record.nextRunAt,
        lastRunAt: record.lastRunAt,
        lastResult: record.lastResult,
        runCount: Number(record.runCount ?? 0),
        path,
        lockExists: existsSync(resolve(dir, `${record.id}.lock`)),
        heartbeat: heartbeatStatus(record),
      };
    });
}

function heartbeatStatus(record) {
  const heartbeat = record.heartbeat ?? null;
  if (!heartbeat) {
    return {
      configured: false,
      type: "external",
      exists: false,
      status: "external",
      path: null,
    };
  }

  const path = heartbeat.path ?? null;
  const exists = Boolean(path && existsSync(path));
  const toml = exists ? readFileSync(path, "utf8") : "";
  return {
    configured: true,
    type: heartbeat.type ?? "unknown",
    id: heartbeat.id ?? null,
    name: heartbeat.name ?? null,
    exists,
    status: readTomlString(toml, "status") ?? heartbeat.status ?? "unknown",
    rrule: readTomlString(toml, "rrule") ?? heartbeat.rrule ?? null,
    path,
  };
}

function countJsonFiles(dir) {
  if (!existsSync(dir)) {
    return 0;
  }
  return readdirSync(dir).filter((name) => name.endsWith(".json")).length;
}

function checkCommand(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    timeout: 5000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    return {
      status: "missing",
      ok: false,
      command,
      detail: result.error.message,
      output: "",
    };
  }
  const output = truncate([result.stdout, result.stderr].filter(Boolean).join("\n"));
  return {
    status: result.status === 0 ? "ready" : "blocked",
    ok: result.status === 0,
    command,
    output,
  };
}

function collectIssues({ packageInfo, npmLatest, plugin, schedules, codexCli, githubRequired, githubCli }) {
  const issues = [];
  if (packageInfo.version && npmLatest.version && compareVersions(packageInfo.version, npmLatest.version) < 0) {
    issues.push({
      code: "stale-package",
      severity: "warning",
      message: `Local package ${packageInfo.version} is behind npm ${npmLatest.version}.`,
    });
  }
  if (plugin.status === "missing") {
    issues.push({
      code: "missing-codex-plugin",
      severity: "warning",
      message: "No local personal Codex plugin cache was found.",
    });
  } else if (packageInfo.version && plugin.version && compareVersions(plugin.version, packageInfo.version) < 0) {
    issues.push({
      code: "stale-codex-plugin",
      severity: "warning",
      message: `Codex plugin ${plugin.version} is behind local package ${packageInfo.version}.`,
    });
  }
  if (!codexCli.ok) {
    issues.push({
      code: "missing-codex-cli",
      severity: "blocker",
      message: "Codex CLI is not available, so execute/tick loops cannot run from this machine.",
    });
  }
  if (schedules.length === 0) {
    issues.push({
      code: "no-schedules",
      severity: "info",
      message: "No local Loop It schedules were found.",
    });
  }
  for (const schedule of schedules) {
    if (schedule.heartbeat.configured && !schedule.heartbeat.exists) {
      issues.push({
        code: "missing-heartbeat",
        severity: "blocker",
        message: `Schedule ${schedule.id} points to a missing Codex heartbeat file.`,
      });
    }
  }
  if (githubRequired && !githubCli.ok) {
    issues.push({
      code: "missing-gh-auth",
      severity: "blocker",
      message: "GitHub connector state exists, but gh auth is not ready.",
    });
  }
  return issues;
}

function nextAction(status) {
  if (status === "missing-heartbeat") {
    return "Recreate the schedule with --heartbeat codex, or update the schedule record to use an existing Codex automation.";
  }
  if (status === "missing-codex-cli") {
    return "Install/authenticate Codex CLI before running execute or scheduled tick loops.";
  }
  if (status === "missing-gh-auth") {
    return "Run gh auth login, then rerun loop-it doctor.";
  }
  if (status === "stale-package" || status === "stale-codex-plugin") {
    return "Update Loop It and rerun loop-it doctor.";
  }
  if (status === "no-schedules") {
    return "Create a time-based or proactive schedule, for example loop-it schedule --from ci-health-watch --execute codex --heartbeat codex.";
  }
  if (status === "missing-codex-plugin") {
    return "Run npm run sync:codex-plugin in this repo, or install the current plugin from the release package.";
  }
  return "Loop It is ready. Run loop-it tick --all --execute codex when a schedule is due.";
}

function printHuman(report) {
  console.log("Loop It doctor");
  console.log(`Status: ${report.status}${report.ok ? "" : " (blocked)"}`);
  console.log(`Package: ${report.package.version ?? "unknown"}${report.npm.version ? ` (npm latest ${report.npm.version})` : ""}`);
  console.log(
    `Codex plugin: ${report.codex.plugin.version ? `${report.codex.plugin.version} at ${report.codex.plugin.path}` : report.codex.plugin.status}`
  );
  console.log(`Project skill: ${report.codex.projectSkill.exists ? `present at ${report.codex.projectSkill.path}` : "not installed in this repo"}`);
  console.log(`Codex CLI: ${report.codex.cli.ok ? `ready (${firstLine(report.codex.cli.output)})` : report.codex.cli.status}`);
  console.log(`Schedules: ${report.schedules.count}`);
  for (const schedule of report.schedules.records) {
    const heartbeat = schedule.heartbeat.configured
      ? `${schedule.heartbeat.type}:${schedule.heartbeat.status}${schedule.heartbeat.exists ? "" : " missing"}`
      : "external";
    console.log(`- ${schedule.id} ${schedule.status} ${schedule.loopId} every ${schedule.every} heartbeat ${heartbeat}`);
  }
  if (report.github.required) {
    console.log(`GitHub: ${report.github.cli.ok ? "ready" : report.github.cli.status}`);
  } else {
    console.log("GitHub: not required");
  }
  if (report.issues.length > 0) {
    console.log("Issues:");
    for (const issue of report.issues) {
      console.log(`- ${issue.code}: ${issue.message}`);
    }
  }
  console.log(`Next action: ${report.nextAction}`);
}

function parseArgs(tokens) {
  const parsed = {};
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("--")) {
      fail(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (["check-gh", "help", "h", "json", "skip-npm-latest"].includes(key)) {
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

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function parseVersion(value) {
  const match = String(value ?? "").match(/\d+(?:\.\d+)*/);
  return match ? match[0].split(".").map((part) => Number.parseInt(part, 10)) : [0];
}

function positiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`${name} must be a positive integer.`);
  }
  return parsed;
}

function readTomlString(toml, key) {
  const match = String(toml).match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"));
  return match ? match[1] : null;
}

function firstLine(value) {
  return String(value ?? "").split(/\r?\n/).find(Boolean) ?? "available";
}

function truncate(value, max = 2000) {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function stringArg(value, fallback) {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }
  return value.trim();
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printUsage() {
  console.log(`Usage:
  loop-it doctor
  loop-it doctor --json
  loop-it doctor --cwd /path/to/repo --codex-home /path/to/.codex

Options:
  --cwd <path>             Repository to inspect. Default: current directory.
  --codex-home <path>      Codex home for plugin and automation files. Default: $CODEX_HOME or ~/.codex.
  --codex-bin <path>       Codex executable override. Default: codex.
  --gh-bin <path>          GitHub CLI executable override. Default: gh.
  --npm-bin <path>         npm executable override. Default: npm.
  --check-gh               Check gh auth even when no GitHub connector state exists.
  --skip-npm-latest        Skip npm latest version lookup.
  --timeout <ms>           Timeout for npm latest lookup. Default: 5000.
  --json                   Print machine-readable diagnostics.`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
