#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { findLoopById, recommendLoop, recommendPrompt } from "./select-loop.mjs";
import { sanitizePromptObjective } from "./goal-library.mjs";
import { resolveCodexCli } from "./lib/codex-cli.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const startScript = resolve(scriptDir, "start-loop.mjs");

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printUsage();
  process.exit(0);
}

const cwd = resolve(stringArg(args.cwd, process.cwd()));
const goal = safePromptObjective(
  stringArg(
    args.goal ?? args._.join(" "),
    "Find the highest-confidence actionable issue in this repository, recommend the right Loop It loop, and run it."
  ),
  { label: "Goal" }
);
const requestedExecute = stringArg(args.execute, "none");
const promptRecommendation = args.from || args.check ? null : safePromptRecommendation(goal);

if (["goal-template", "custom"].includes(promptRecommendation?.kind)) {
  const selectedGoalTemplate = promptRecommendation.selected?.goal ?? null;
  const promptPlan = selectedGoalTemplate
    ? {
        kind: "goal-template",
        action: "prompt-ready",
        goalTemplateId: selectedGoalTemplate.id,
        goalTemplateTitle: selectedGoalTemplate.title,
        category: selectedGoalTemplate.category,
        goal,
        expectedArtifact: selectedGoalTemplate.expectedArtifact,
        proof: selectedGoalTemplate.proof,
        maxIterations: selectedGoalTemplate.maxIterations,
        prompt: promptRecommendation.prompt,
        canExecuteUnattended: false,
        nextAction: "Open the generated prompt in an interactive agent and review the artifact against its rubric.",
      }
    : {
        kind: "custom",
        action: "prompt-ready",
        goal,
        reason: promptRecommendation.reason,
        maxIterations: 3,
        prompt: promptRecommendation.prompt,
        canExecuteUnattended: false,
        nextAction: "Open the custom prompt in an interactive agent and confirm its result against reviewable evidence.",
      };
  if (args.json) {
    console.log(JSON.stringify(promptPlan, null, 2));
    process.exit(requestedExecute === "none" ? 0 : 2);
  }
  if (requestedExecute !== "none") {
    console.log(
      selectedGoalTemplate
        ? "This goal uses rubric-based artifact proof and is ready as an interactive prompt, not unattended execution."
        : "No library item matched confidently, so this request is ready as an interactive custom prompt, not unattended execution."
    );
    console.log("");
  }
  console.log(promptPlan.prompt);
  process.exit(requestedExecute === "none" ? 0 : 2);
}

const repo = inspectRepository(cwd);
const loop = selectLoop(args, goal, repo);
const check = stringArg(args.check, inferCheck(goal, repo));
const maxIterations = stringArg(args["max-iterations"], loop.maxIterations ?? "3");
const iterationCap = positiveInteger(maxIterations, "--max-iterations");
const agent = stringArg(args.agent, "codex");
const execute = requestedExecute;
const checker = stringArg(args.checker ?? args.review, "none");
const isolateWorktree = Boolean(args.worktree);

if (!["none", "codex"].includes(execute)) {
  fail(`Unsupported --execute value: ${execute}`);
}
if (execute === "codex" && !["codex", "all"].includes(agent)) {
  fail("--execute codex requires --agent codex or --agent all");
}
if (!["none", "codex"].includes(checker)) {
  fail(`Unsupported --checker value: ${checker}`);
}
if (checker === "codex" && execute !== "codex") {
  fail("--checker codex requires --execute codex");
}
if (isolateWorktree && execute !== "codex") {
  fail("--worktree requires --execute codex");
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
  checker,
  worktree: isolateWorktree
    ? {
        requested: true,
        base: stringArg(args["worktree-base"], "auto"),
        branch: stringArg(args["worktree-branch"], "auto"),
        path: stringArg(args["worktree-dir"], "auto"),
      }
    : { requested: false },
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

const isolation = isolateWorktree
  ? prepareIsolatedWorktree(cwd, {
      goal,
      base: args["worktree-base"],
      branch: args["worktree-branch"],
      dir: args["worktree-dir"],
    })
  : null;
const runCwd = isolation?.executionCwd ?? cwd;

if (isolation) {
  console.log(`Worktree isolation: ${isolation.path}`);
  console.log(`Worktree branch: ${isolation.branch}`);
  console.log(`Worktree base: ${isolation.base}`);
}

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
  cwd: runCwd,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (execute === "codex") {
  executeWithCodex({
    cwd: runCwd,
    goal,
    check,
    loop,
    maxIterations: iterationCap,
    checker,
    worktree: isolation ? publicWorktreeInfo(isolation) : null,
  });
}

process.exit(0);

function executeWithCodex(run) {
  const launchPath = resolve(run.cwd, ".loop-it", "LAUNCH.md");
  const outputPath = resolve(run.cwd, stringArg(args["codex-output"], ".loop-it/CODEX_FINAL.md"));
  const codexCli = resolveCodexCli({ requested: stringArg(args["codex-bin"], "") });
  const codexBin = codexCli.bin;
  const sandbox = stringArg(args["codex-sandbox"], "workspace-write");
  const checkerBin = args["checker-bin"]
    ? resolveCodexCli({ requested: stringArg(args["checker-bin"], "") }).bin
    : codexBin;
  const checkerSandbox = stringArg(args["checker-sandbox"], "read-only");
  const checkerOutputPath = resolve(run.cwd, stringArg(args["checker-output"], ".loop-it/CODEX_CHECKER.md"));

  if (!existsSync(launchPath)) {
    fail(`Expected launch file to exist before execution: ${launchPath}`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  const launch = readFileSync(launchPath, "utf8");
  let previousFailureSignature = null;
  let previousVerifierOutput = "";
  const proofIterations = [];

  if (codexCli.source === "desktop") {
    console.log(`Using Codex Desktop CLI: ${codexBin}`);
  }

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
        ...worktreePatch(run),
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
        ...worktreePatch(run),
      });
      process.exit(codexResult.status ?? 1);
    }

    const observation = verifyAfterCodex(
      {
        ...run,
        checkerBin,
        checkerSandbox,
        checkerOutputPath,
      },
      iterationOutputPath,
      iteration,
      proofIterations
    );
    proofIterations.push(observation.iterationProof);

    if (observation.result === "pass") {
      return;
    }
    if (observation.result === "manual-verification-required") {
      process.exit(2);
    }
    if (["checker-blocked", "checker-blocker", "checker-inconclusive"].includes(observation.result)) {
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
      ...worktreePatch(run),
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
        ...worktreePatch(run),
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
    ...worktreePatch(run),
  };

  if (verifier.status === 0) {
    const checkerReceipt = runCheckerAfterVerifier(run, {
      iteration,
      check,
      verifierOutput: output,
      codexOutput,
      changedFiles: files,
    });
    const checkerPassed = ["pass", "skipped"].includes(checkerReceipt.result);
    const result = checkerPassed
      ? "pass"
      : checkerReceipt.result === "blocker"
        ? "checker-blocked"
        : `checker-${checkerReceipt.result}`;
    const blockers = checkerPassed ? [] : [checkerReceipt.summary];
    const remainingRisks = checkerPassed
      ? []
      : ["The verifier passed, but the checker did not approve the run proof."];
    const nextAction =
      checkerReceipt.result === "pass"
        ? "Stop; verifier and checker passed after Codex execution."
        : checkerReceipt.result === "skipped"
          ? "Stop; verifier passed after Codex execution. Add --checker codex when independent review proof is required."
          : "Stop; inspect the checker output before continuing or accepting the run.";

    recordProgressIteration(cwd, {
      iteration,
      phase: checkerReceipt.result === "skipped" ? "VERIFY" : "CHECKER",
      check,
      result,
      outputSummary: truncate(output, 1200),
      changedFiles: files,
      blockers,
      remainingRisks,
      nextAction,
      checker: checkerReceipt,
    }, {
      status: checkerPassed ? "completed" : "blocked",
      currentIteration: iteration,
      lastCheck: check,
      lastResult: result,
      lastExecutor: "codex",
      lastCodexOutput: codexOutput,
      lastVerifierOutput: truncate(output),
      lastChecker: checkerReceipt.result,
      lastCheckerOutput: checkerReceipt.outputPath,
      blockers,
      remainingRisks,
      recommendedNextAction: nextAction,
      changedFiles: files,
      ...worktreePatch(run),
      proof: {
        selectedLoopId: run.loop.id,
        selectedLoopTitle: run.loop.title,
        executor: "codex",
        verifier: check,
        result,
        iteration,
        maxIterations: run.maxIterations,
        codexOutput,
        changedFiles: files,
        checker: checkerReceipt,
        iterations: [...previousProofIterations, iterationProof],
        ...worktreePatch(run),
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
      checker: checkerReceipt,
      worktree: run.worktree,
    });
    return {
      result: checkerPassed ? "pass" : result,
      output,
      files,
      codexOutput,
      iterationProof,
      checker: checkerReceipt,
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
    ...worktreePatch(run),
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
      ...worktreePatch(run),
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

function runCheckerAfterVerifier(run, context) {
  if (run.checker === "none") {
    return {
      type: "none",
      result: "skipped",
      summary: "Checker pass skipped.",
      outputPath: null,
      reviewed: {
        verifier: context.check,
        codexOutput: context.codexOutput,
        progress: ".loop-it/progress.json",
      },
    };
  }

  const checkerOutputPath = run.checkerOutputPath;
  const checkerOutput = relativeToCwd(run.cwd, checkerOutputPath);
  mkdirSync(dirname(checkerOutputPath), { recursive: true });
  const checkerArgs = ["exec"];
  if (args["skip-git-repo-check"]) {
    checkerArgs.push("--skip-git-repo-check");
  }
  if (args["codex-ignore-user-config"] || args["checker-ignore-user-config"]) {
    checkerArgs.push("--ignore-user-config");
  }
  if (run.checkerSandbox !== "none") {
    checkerArgs.push("--sandbox", run.checkerSandbox);
  }
  checkerArgs.push("--output-last-message", checkerOutputPath, buildCheckerPrompt(run, context));

  console.log("");
  console.log("Running read-only checker with Codex CLI.");
  console.log(`Executing checker: ${run.checkerBin} ${checkerArgs.slice(0, -1).join(" ")}`);
  const checkerResult = spawnSync(run.checkerBin, checkerArgs, {
    cwd: run.cwd,
    stdio: "inherit",
  });

  if (checkerResult.error) {
    return {
      type: "codex",
      result: "blocked",
      summary: `Checker execution failed: ${checkerResult.error.message}`,
      outputPath: checkerOutput,
      reviewed: {
        verifier: context.check,
        codexOutput: context.codexOutput,
        progress: ".loop-it/progress.json",
      },
    };
  }

  if (checkerResult.status !== 0) {
    return {
      type: "codex",
      result: "blocked",
      summary: `Checker CLI exited ${checkerResult.status ?? 1}`,
      outputPath: checkerOutput,
      reviewed: {
        verifier: context.check,
        codexOutput: context.codexOutput,
        progress: ".loop-it/progress.json",
      },
    };
  }

  const output = existsSync(checkerOutputPath) ? readFileSync(checkerOutputPath, "utf8").trim() : "";
  const parsed = parseCheckerResult(output);
  const summary =
    parsed === "pass"
      ? "Checker approved the verifier-passing run."
      : parsed === "blocker"
        ? extractCheckerBlocker(output)
        : "Checker output did not include CHECKER_RESULT: pass or CHECKER_RESULT: blocker.";

  if (parsed === "pass") {
    console.log("Checker passed.");
  } else {
    console.log(`Checker did not approve: ${summary}`);
  }

  return {
    type: "codex",
    result: parsed,
    summary,
    outputPath: checkerOutput,
    outputSummary: truncate(output),
    reviewed: {
      verifier: context.check,
      codexOutput: context.codexOutput,
      progress: ".loop-it/progress.json",
      changedFiles: context.changedFiles,
    },
  };
}

function buildCheckerPrompt(run, context) {
  return [
    "Review this Loop It run as a read-only checker.",
    "",
    "Rules:",
    "- Do not edit files.",
    "- Do not run destructive commands.",
    "- Inspect the changed files, .loop-it/progress.json, the Codex output file, and the verifier evidence.",
    "- Approve only when the changed files match the goal and the verifier proof is credible.",
    "",
    `Goal: ${run.goal}`,
    `Selected loop: ${run.loop.title} (${run.loop.id})`,
    `Verifier that passed: ${context.check}`,
    `Iteration: ${context.iteration} of ${run.maxIterations}`,
    `Codex output file: ${context.codexOutput}`,
    `Changed files: ${context.changedFiles.length ? context.changedFiles.join(", ") : "none"}`,
    "",
    "Verifier output:",
    truncate(context.verifierOutput || "(no verifier output)", 1600),
    "",
    "Return exactly one marker line:",
    "CHECKER_RESULT: pass",
    "or",
    "CHECKER_RESULT: blocker",
    "",
    "If blocked, include one line starting with CHECKER_BLOCKER: that states the concrete reason.",
  ].join("\n");
}

function prepareIsolatedWorktree(cwd, options) {
  const sourceRoot = gitOutput(cwd, ["rev-parse", "--show-toplevel"], "Loop It can only create an isolated worktree inside a git repository.");
  const base = stringArg(options.base, "") || resolveDefaultWorktreeBase(sourceRoot);
  const branch = stringArg(options.branch, defaultWorktreeBranch(options.goal));
  const path = options.dir
    ? resolve(cwd, options.dir)
    : resolve(dirname(sourceRoot), `${basename(sourceRoot)}-${safePathSegment(branch)}`);

  if (existsSync(path)) {
    fail(`Worktree path already exists: ${path}`);
  }

  const add = spawnSync("git", ["worktree", "add", "-b", branch, path, base], {
    cwd: sourceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (add.error) {
    fail(`Could not create isolated worktree: ${add.error.message}`);
  }
  if (add.status !== 0) {
    fail(
      [
        `Could not create isolated worktree from ${base}.`,
        add.stdout.trim(),
        add.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const subdir = relative(sourceRoot, cwd);
  const executionCwd = subdir && subdir !== "." ? resolve(path, subdir) : path;
  if (!existsSync(executionCwd)) {
    fail(`Created worktree, but the target subdirectory does not exist on ${base}: ${executionCwd}`);
  }

  return {
    enabled: true,
    sourceCwd: cwd,
    sourceRoot,
    path,
    executionCwd,
    branch,
    base,
  };
}

function publicWorktreeInfo(worktree) {
  if (!worktree) {
    return null;
  }
  return {
    enabled: true,
    sourceCwd: worktree.sourceCwd,
    sourceRoot: worktree.sourceRoot,
    path: worktree.path,
    executionCwd: worktree.executionCwd,
    branch: worktree.branch,
    base: worktree.base,
  };
}

function worktreePatch(run) {
  return run.worktree ? { worktree: run.worktree } : {};
}

function resolveDefaultWorktreeBase(sourceRoot) {
  for (const ref of ["origin/main", "main", "origin/master", "master", "HEAD"]) {
    const result = spawnSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
      cwd: sourceRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status === 0) {
      return ref;
    }
  }
  fail("Could not find a base ref for the isolated worktree. Pass --worktree-base <ref>.");
}

function defaultWorktreeBranch(goal) {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `codex/loop-it-${slug(goal)}-${stamp}`;
}

function slug(value) {
  const text = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return text || "run";
}

function safePathSegment(value) {
  return String(value)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "loop-it-worktree";
}

function gitOutput(cwd, commandArgs, failureMessage) {
  const result = spawnSync("git", commandArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    fail(`${failureMessage} ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(
      [
        failureMessage,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return result.stdout.trim();
}

function parseCheckerResult(output) {
  if (/^CHECKER_RESULT:\s*pass\b/im.test(output)) {
    return "pass";
  }
  if (/^CHECKER_RESULT:\s*blocker\b/im.test(output)) {
    return "blocker";
  }
  return "inconclusive";
}

function extractCheckerBlocker(output) {
  const match = output.match(/^CHECKER_BLOCKER:\s*(.+)$/im);
  return match?.[1]?.trim() || "Checker reported a blocker without a concrete reason.";
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
    ["publishing", /\b(npm publish|publish (?:the )?package|publish to npm|publish release)\b/],
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
    ...worktreePatch(run),
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
      ...worktreePatch(run),
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

function printRunProof({ loop, executor, verifier, result, iteration, maxIterations, codexOutput, changedFiles: files, checker, worktree }) {
  console.log("");
  console.log("Run proof:");
  console.log(`- Selected loop: ${loop.title} (${loop.id})`);
  console.log(`- Executor: ${executor}`);
  console.log(`- Verifier: ${verifier}`);
  console.log(`- Result: ${result}`);
  if (checker) {
    const checkerDetail =
      checker.result === "skipped"
        ? "skipped"
        : `${checker.result}${checker.outputPath ? ` (${checker.outputPath})` : ""}`;
    console.log(`- Checker: ${checkerDetail}`);
  }
  if (iteration && maxIterations) {
    console.log(`- Iteration: ${iteration}/${maxIterations}`);
  }
  if (worktree) {
    console.log(`- Worktree: ${worktree.path}`);
    console.log(`- Worktree branch: ${worktree.branch}`);
    console.log(`- Worktree base: ${worktree.base}`);
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
    if (
      [
        "force",
        "json",
        "skip-git-repo-check",
        "codex-ignore-user-config",
        "checker-ignore-user-config",
        "worktree",
        "help",
        "h",
      ].includes(key)
    ) {
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

function safePromptObjective(value, options) {
  try {
    return sanitizePromptObjective(value, options);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function safePromptRecommendation(goal) {
  try {
    return recommendPrompt({ goal });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
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
  --checker <none|codex>    Optional read-only checker after the verifier passes, default none
  --codex-bin <path>        Codex executable override; otherwise discover PATH or Codex Desktop
  --codex-sandbox <mode>    Codex sandbox mode, default workspace-write; use none to omit
  --codex-output <path>     Last Codex message path, default .loop-it/CODEX_FINAL.md
  --checker-bin <path>      Checker Codex executable, default --codex-bin
  --checker-sandbox <mode>  Checker sandbox mode, default read-only; use none to omit
  --checker-output <path>   Checker receipt path, default .loop-it/CODEX_CHECKER.md
  --worktree                Create a fresh git worktree/branch and run Codex there
  --worktree-base <ref>     Base ref for --worktree, default origin/main, main, origin/master, master, or HEAD
  --worktree-branch <name>  Branch name for --worktree, default codex/loop-it-<goal>-<timestamp>
  --worktree-dir <path>     Worktree path for --worktree, default sibling of the source repo
  --codex-ignore-user-config  Pass --ignore-user-config to codex exec
  --checker-ignore-user-config Pass --ignore-user-config to the checker Codex exec
  --skip-git-repo-check     Pass --skip-git-repo-check to codex exec
  --json                    Print the selected run plan and readiness preflight without writing files
  --force                   Replace existing .loop-it files`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
