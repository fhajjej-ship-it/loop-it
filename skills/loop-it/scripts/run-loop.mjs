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
const iterationCap = positiveInteger(maxIterations, "--max-iterations");
const agent = stringArg(args.agent, "codex");
const execute = stringArg(args.execute, "none");

if (!["none", "codex"].includes(execute)) {
  fail(`Unsupported --execute value: ${execute}`);
}
if (execute === "codex" && !["codex", "all"].includes(agent)) {
  fail("--execute codex requires --agent codex or --agent all");
}

const readiness = assessReadiness({
  goal,
  check,
  repo,
  execute,
  iterationCap,
});

const plan = {
  goal,
  cwd,
  selectedLoopId: loop.id,
  selectedLoopTitle: loop.title,
  check,
  maxIterations: iterationCap,
  agent,
  execute,
  readiness,
  repoSignals: repo,
};

if (args.json) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

console.log(`Recommended loop: ${loop.title} (${loop.id})`);
console.log(`Goal: ${goal}`);
console.log(`Verifier: ${check}`);
printReadiness(readiness);
if (repo.summary.length) {
  console.log(`Repo signals: ${repo.summary.join(", ")}`);
}

if (execute === "codex" && readiness.action !== "run") {
  console.log("");
  console.log("Loop It did not start Codex because this run is not ready for unattended execution.");
  if (readiness.nextAction) {
    console.log(`Next action: ${readiness.nextAction}`);
  }
  process.exit(2);
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
    maxIterations: iterationCap,
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
  let previousFailureSignature = null;
  let previousVerifierOutput = "";
  const proofIterations = [];

  for (let iteration = 1; iteration <= run.maxIterations; iteration += 1) {
    const iterationOutputPath = outputPathForIteration(outputPath, iteration);
    mkdirSync(dirname(iterationOutputPath), { recursive: true });
    const prompt = buildCodexPrompt(run, launch, iteration, previousVerifierOutput);
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
    codexArgs.push("--output-last-message", iterationOutputPath, prompt);

    console.log("");
    console.log(`Codex iteration ${iteration}/${run.maxIterations}`);
    console.log(`Executing loop with Codex CLI: ${codexBin} ${codexArgs.slice(0, -1).join(" ")}`);
    const codexResult = spawnSync(codexBin, codexArgs, {
      cwd: run.cwd,
      stdio: "inherit",
    });

    if (codexResult.error) {
      recordProgressIteration(run.cwd, {
        iteration,
        phase: "EXECUTE",
        check: run.check,
        result: "blocked",
        outputSummary: `Codex execution failed: ${codexResult.error.message}`,
        changedFiles: changedFiles(run.cwd),
        blockers: [`Codex execution failed: ${codexResult.error.message}`],
        remainingRisks: ["Codex execution did not complete, so the verifier was not run."],
        nextAction: "Install or authenticate Codex CLI, then rerun loop-it run --execute codex.",
      }, {
        status: "blocked",
        currentIteration: iteration,
        lastResult: "blocked",
        lastExecutor: "codex",
        blockers: [`Codex execution failed: ${codexResult.error.message}`],
        remainingRisks: ["Codex execution did not complete, so the verifier was not run."],
        recommendedNextAction: "Install or authenticate Codex CLI, then rerun loop-it run --execute codex.",
      });
      fail(`Codex execution failed: ${codexResult.error.message}`);
    }

    if (codexResult.status !== 0) {
      const codexOutput = relativeToCwd(run.cwd, iterationOutputPath);
      recordProgressIteration(run.cwd, {
        iteration,
        phase: "EXECUTE",
        check: run.check,
        result: "blocked",
        outputSummary: `Codex CLI exited ${codexResult.status ?? 1}`,
        changedFiles: changedFiles(run.cwd),
        blockers: [`Codex CLI exited ${codexResult.status ?? 1}`],
        remainingRisks: ["Codex execution did not complete, so the verifier was not run."],
        nextAction: `Inspect ${codexOutput} and rerun the loop after resolving the blocker.`,
      }, {
        status: "blocked",
        currentIteration: iteration,
        lastResult: "blocked",
        lastExecutor: "codex",
        lastCodexOutput: codexOutput,
        blockers: [`Codex CLI exited ${codexResult.status ?? 1}`],
        remainingRisks: ["Codex execution did not complete, so the verifier was not run."],
        recommendedNextAction: `Inspect ${codexOutput} and rerun the loop after resolving the blocker.`,
      });
      process.exit(codexResult.status ?? 1);
    }

    const observation = verifyAfterCodex(run, iterationOutputPath, iteration, proofIterations);
    proofIterations.push(observation.iterationProof);

    if (observation.result === "pass") {
      return;
    }
    if (observation.result === "manual-verification-required") {
      process.exit(2);
    }

    if (previousFailureSignature && previousFailureSignature === observation.failureSignature) {
      markStoppedAfterFailure(run, observation, proofIterations, "repeated-failure");
      fail(`Verifier failure repeated after Codex iteration ${iteration}: ${run.check}`);
    }

    previousFailureSignature = observation.failureSignature;
    previousVerifierOutput = observation.output;

    if (iteration >= run.maxIterations) {
      markStoppedAfterFailure(run, observation, proofIterations, "iteration-cap-reached");
      fail(`Iteration cap reached with verifier still failing: ${run.check}`);
    }

    console.log("");
    console.log(`Verifier still failed after Codex iteration ${iteration}: ${run.check}`);
    console.log(`Continuing to iteration ${iteration + 1}/${run.maxIterations}.`);
  }
}

function buildCodexPrompt(run, launch, iteration, previousVerifierOutput) {
  return [
    "Run this Loop It contract now.",
    `Selected loop: ${run.loop.title} (${run.loop.id})`,
    `Goal: ${run.goal}`,
    `Verifier: ${run.check}`,
    `Iteration: ${iteration} of ${run.maxIterations}`,
    `Iteration cap: ${run.maxIterations}`,
    previousVerifierOutput
      ? "The previous verifier attempt failed. Make a different, evidence-based change; do not only update .loop-it files."
      : "",
    previousVerifierOutput ? "Previous verifier output:" : "",
    previousVerifierOutput ? truncate(previousVerifierOutput, 1600) : "",
    "",
    launch,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function verifyAfterCodex(run, codexOutputPath, iteration, previousProofIterations) {
  const { cwd, check } = run;
  const codexOutput = relativeToCwd(cwd, codexOutputPath);
  if (isManualCheck(check)) {
    const files = changedFiles(cwd);
    recordProgressIteration(cwd, {
      iteration,
      phase: "VERIFY",
      check,
      result: "manual-verification-required",
      outputSummary: "Verifier is manual, so Loop It cannot prove completion automatically.",
      changedFiles: files,
      blockers: ["Verifier is manual, so Loop It cannot prove completion automatically."],
      remainingRisks: ["Run the manual verifier before calling this loop complete."],
      nextAction: `Run the manual verifier and record the result in .loop-it/progress.json. Codex output: ${codexOutput}`,
    }, {
      status: "blocked",
      currentIteration: iteration,
      lastCheck: check,
      lastResult: "manual-verification-required",
      lastExecutor: "codex",
      lastCodexOutput: codexOutput,
      blockers: ["Verifier is manual, so Loop It cannot prove completion automatically."],
      remainingRisks: ["Run the manual verifier before calling this loop complete."],
      recommendedNextAction: `Run the manual verifier and record the result in .loop-it/progress.json. Codex output: ${codexOutput}`,
      changedFiles: files,
    });
    console.log("");
    console.log(`Manual verifier required: ${check}`);
    return {
      result: "manual-verification-required",
      iterationProof: {
        iteration,
        result: "manual-verification-required",
        codexOutput,
        changedFiles: files,
      },
    };
  }

  console.log("");
  console.log(`Running verifier after Codex iteration ${iteration}: ${check}`);
  const verifier = spawnSync(check, {
    cwd,
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [verifier.stdout, verifier.stderr].filter(Boolean).join("\n").trim();
  const files = changedFiles(cwd);
  const iterationProof = {
    iteration,
    result: verifier.status === 0 ? "pass" : "failed",
    codexOutput,
    changedFiles: files,
    verifierOutput: truncate(output),
  };

  if (verifier.status === 0) {
    recordProgressIteration(cwd, {
      iteration,
      phase: "VERIFY",
      check,
      result: "pass",
      outputSummary: truncate(output, 1200),
      changedFiles: files,
      blockers: [],
      remainingRisks: [],
      nextAction: "Stop; verifier passed after Codex execution.",
    }, {
      status: "completed",
      currentIteration: iteration,
      lastCheck: check,
      lastResult: "pass",
      lastExecutor: "codex",
      lastCodexOutput: codexOutput,
      lastVerifierOutput: truncate(output),
      blockers: [],
      remainingRisks: [],
      recommendedNextAction: "Stop; verifier passed after Codex execution.",
      changedFiles: files,
      proof: {
        selectedLoopId: run.loop.id,
        selectedLoopTitle: run.loop.title,
        executor: "codex",
        verifier: check,
        result: "pass",
        iteration,
        maxIterations: run.maxIterations,
        codexOutput,
        changedFiles: files,
        iterations: [...previousProofIterations, iterationProof],
      },
    });
    if (output) {
      console.log(output);
    }
    console.log(`Verifier passed after Codex iteration ${iteration}: ${check}`);
    printRunProof({
      loop: run.loop,
      executor: "Codex CLI",
      verifier: check,
      result: "pass",
      iteration,
      maxIterations: run.maxIterations,
      codexOutput,
      changedFiles: files,
    });
    return {
      result: "pass",
      output,
      files,
      codexOutput,
      iterationProof,
    };
  }

  recordProgressIteration(cwd, {
    iteration,
    phase: "VERIFY",
    check,
    result: "failed",
    outputSummary: truncate(output, 1200),
    changedFiles: files,
    blockers: [],
    remainingRisks: [`Verifier still fails: ${check}`],
    nextAction: "Continue only if the next pass has a clear expected improvement.",
  }, {
    status: "active",
    currentIteration: iteration,
    lastCheck: check,
    lastResult: "failed",
    lastExecutor: "codex",
    lastCodexOutput: codexOutput,
    lastVerifierOutput: truncate(output),
    blockers: [],
    remainingRisks: [`Verifier still fails: ${check}`],
    recommendedNextAction: "Inspect the verifier output and rerun the loop only if the next pass has a clear expected improvement.",
    changedFiles: files,
    proof: {
      selectedLoopId: run.loop.id,
      selectedLoopTitle: run.loop.title,
      executor: "codex",
      verifier: check,
      result: "failed",
      iteration,
      maxIterations: run.maxIterations,
      codexOutput,
      changedFiles: files,
      iterations: [...previousProofIterations, iterationProof],
    },
  });
  if (output) {
    console.error(output);
  }
  return {
    result: "failed",
    output,
    files,
    codexOutput,
    iterationProof,
    failureSignature: failureSignature(output, verifier.status),
  };
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

function assessReadiness({ goal, check, repo, execute, iterationCap }) {
  const blockers = [];
  const warnings = [];
  const questions = [];
  const signals = [];
  const approvalRisks = approvalRiskSignals(goal, check);
  const automatedVerifier = !isManualCheck(check);

  if (String(goal ?? "").trim()) {
    signals.push("goal present");
  } else {
    blockers.push("Missing a concrete goal.");
    questions.push("What should be true when the loop is done?");
  }

  if (automatedVerifier) {
    signals.push("automated verifier present");
  } else {
    blockers.push("No automated verifier was found.");
    questions.push("What command should fail bad output and pass good output?");
  }

  if (repo.hasPackageJson && repo.scripts.length > 0) {
    signals.push(`repo scripts available: ${repo.scripts.slice(0, 5).join(", ")}`);
  } else if (!automatedVerifier) {
    warnings.push("No package scripts were found, so Loop It cannot infer a safe local check.");
  }

  if (iterationCap > 0) {
    signals.push(`iteration cap ${iterationCap}`);
  } else {
    blockers.push("Missing a positive iteration cap.");
  }

  if (approvalRisks.length > 0) {
    blockers.push(`Approval required before unattended execution: ${approvalRisks.join(", ")}.`);
  }

  let action = execute === "codex" ? "run" : "prepare-only";
  let nextAction =
    execute === "codex"
      ? "Start Codex execution and rerun the verifier after each pass."
      : "Prepare the loop contract and launch prompt; add --execute codex when you want local execution.";

  if (!automatedVerifier) {
    action = execute === "codex" ? "ask-for-check" : "prepare-only";
    nextAction = "Provide an automated verifier command, or run without --execute and complete manual proof yourself.";
  }

  if (approvalRisks.length > 0) {
    action = "approval-required";
    nextAction = "Get explicit approval or narrow the goal to local, reversible verification work.";
  }

  if (blockers.length > 0 && action === "run") {
    action = "ask-for-check";
    nextAction = questions[0] ?? "Resolve the readiness blockers before running Codex.";
  }

  return {
    action,
    canExecute: action === "run",
    automatedVerifier,
    approvalRisks,
    blockers,
    warnings,
    questions,
    signals,
    nextAction,
  };
}

function approvalRiskSignals(...values) {
  const text = values.filter(Boolean).join("\n").toLowerCase();
  const risks = [];
  const patterns = [
    ["production write", /\b(production write|write to production|prod write|production data)\b/],
    ["deployment", /\b(deploy to production|production deploy|release to production|ship to production|vercel deploy --prod|--prod)\b/],
    ["publishing", /\b(npm publish|publish package|publish to npm|publish release)\b/],
    ["external message", /\b(send email|send slack|post to slack|external message|notify customer)\b/],
    ["payments", /\b(payment|payments|billing|stripe|invoice|charge customer)\b/],
    ["credentials", /\b(secret|credential|api key|token rotation|rotate key|otp)\b/],
    ["destructive git operation", /\b(git reset --hard|git clean|force push|delete branch|rewrite history)\b/],
    ["irreversible data change", /\b(migration on production|drop table|delete production|irreversible)\b/],
  ];

  for (const [label, pattern] of patterns) {
    if (pattern.test(text)) {
      risks.push(label);
    }
  }

  return [...new Set(risks)];
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

function recordProgressIteration(cwd, entry, patch) {
  const progressPath = resolve(cwd, ".loop-it", "progress.json");
  if (!existsSync(progressPath)) {
    return;
  }

  const current = readJson(progressPath);
  const next = {
    ...current,
    ...patch,
    iterations: [...(Array.isArray(current.iterations) ? current.iterations : []), entry],
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(progressPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function markStoppedAfterFailure(run, observation, proofIterations, reason) {
  const repeated = reason === "repeated-failure";
  const blocker = repeated
    ? `Verifier failure repeated after Codex iteration ${observation.iterationProof.iteration}: ${run.check}`
    : `Iteration cap ${run.maxIterations} reached with verifier still failing: ${run.check}`;
  const nextAction = repeated
    ? "Stop and inspect the repeated verifier failure before rerunning the loop."
    : "Stop and inspect the remaining verifier failure; increase the cap only after identifying a new expected improvement.";
  updateProgress(run.cwd, {
    status: "blocked",
    currentIteration: observation.iterationProof.iteration,
    lastCheck: run.check,
    lastResult: reason,
    lastExecutor: "codex",
    lastCodexOutput: observation.codexOutput,
    lastVerifierOutput: truncate(observation.output),
    blockers: [blocker],
    remainingRisks: [`Verifier still fails: ${run.check}`],
    recommendedNextAction: nextAction,
    changedFiles: observation.files,
    proof: {
      selectedLoopId: run.loop.id,
      selectedLoopTitle: run.loop.title,
      executor: "codex",
      verifier: run.check,
      result: reason,
      iteration: observation.iterationProof.iteration,
      maxIterations: run.maxIterations,
      codexOutput: observation.codexOutput,
      changedFiles: observation.files,
      iterations: proofIterations,
    },
  });
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

function failureSignature(output, status) {
  const normalized = String(output || "")
    .replace(/\bat .+:\d+:\d+\)?/g, "at <stack>")
    .replace(/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z\b/g, "<timestamp>")
    .replace(/\s+/g, " ")
    .trim();
  return `${status ?? "unknown"}:${normalized.slice(0, 2000)}`;
}

function outputPathForIteration(basePath, iteration) {
  if (iteration === 1) {
    return basePath;
  }
  if (basePath.endsWith(".md")) {
    return basePath.replace(/\.md$/, `.iteration-${iteration}.md`);
  }
  return `${basePath}.iteration-${iteration}`;
}

function printRunProof({ loop, executor, verifier, result, iteration, maxIterations, codexOutput, changedFiles: files }) {
  console.log("");
  console.log("Run proof:");
  console.log(`- Selected loop: ${loop.title} (${loop.id})`);
  console.log(`- Executor: ${executor}`);
  console.log(`- Verifier: ${verifier}`);
  console.log(`- Result: ${result}`);
  if (iteration && maxIterations) {
    console.log(`- Iteration: ${iteration}/${maxIterations}`);
  }
  console.log(`- Progress: .loop-it/progress.json`);
  console.log(`- Codex output: ${codexOutput}`);
  console.log(`- Changed files: ${files.length ? files.join(", ") : "none"}`);
}

function printReadiness(readiness) {
  console.log(`Readiness: ${readiness.action}`);
  if (readiness.blockers.length > 0) {
    console.log(`Readiness blockers: ${readiness.blockers.join(" ")}`);
  }
  if (readiness.warnings.length > 0) {
    console.log(`Readiness warnings: ${readiness.warnings.join(" ")}`);
  }
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

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    fail(`${label} must be a positive integer`);
  }
  return parsed;
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
  --json                    Print the selected run plan and readiness preflight without writing files
  --force                   Replace existing .loop-it files`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
