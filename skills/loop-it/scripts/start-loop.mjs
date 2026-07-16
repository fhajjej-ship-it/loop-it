#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  assertPromptText,
  hasPromptCommandSyntax,
  sanitizePromptObjective,
} from "./goal-library.mjs";
import { findLoopById, loopDefaults } from "./select-loop.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printUsage();
  process.exit(0);
}

const libraryLoop = args.from ? findLibraryLoop(args.from) : null;
const defaults = libraryLoop ? loopDefaults(libraryLoop) : {};
const goal = safePromptObjective(requiredString(args.goal, "--goal"), {
  label: "Goal",
});
const check = requiredString(args.check, "--check");
const name = stringArg(args.name, defaults.name ?? "Agent Loop");
const scope = stringArg(args.scope, "current working tree");
const agent = stringArg(args.agent, "all");
const output = stringArg(args.output, ".loop-it/LOOP.md");
const launchOutput = stringArg(args["launch-output"], ".loop-it/LAUNCH.md");
const maxIterations = positiveIntegerArg(args["max-iterations"], defaults.maxIterations ?? "5", "--max-iterations");
const stop = stringArg(
  args.stop,
  "verifier passes, iteration cap is reached, the same failure repeats twice, required access is missing, approval is needed, or an unsafe action would be required"
);
const approval = stringArg(
  args.approval,
  "production writes, external messages, payments, destructive git operations, credential changes, deploys, or irreversible data changes"
);
const now = new Date().toISOString();
const agents = resolveAgents(agent);
const contract = {
  name,
  goal,
  check,
  maxIterations,
  stop,
  approval,
  scope,
  agents,
  libraryLoop,
  now,
};
const loopContent = renderLoopContract(contract);
const launchContent = renderLaunchGuide(contract, { hasLocalContract: !args.print });
assertPromptText(launchContent, "Generated launch prompt");
const progress = progressState(contract);

if (args.print) {
  process.stdout.write(launchContent);
  process.exit(0);
}

const target = resolve(process.cwd(), output);
const launchTarget = resolve(process.cwd(), launchOutput);
const progressTarget = resolve(dirname(target), "progress.json");

for (const file of [target, launchTarget, progressTarget]) {
  if (existsSync(file) && !args.force) {
    fail(`${file} already exists. Re-run with --force to replace it.`);
  }
}

mkdirSync(dirname(target), { recursive: true });
mkdirSync(dirname(launchTarget), { recursive: true });
writeFileSync(target, loopContent, "utf8");
writeFileSync(launchTarget, launchContent, "utf8");
writeFileSync(progressTarget, JSON.stringify(progress, null, 2) + "\n", "utf8");

console.log(`Created ${output}`);
console.log(`Created ${dirname(output)}/progress.json`);
console.log(`Created ${launchOutput}`);
console.log("");
process.stdout.write(launchContent);

function renderLoopContract(loop) {
  const librarySection = loop.libraryLoop
    ? `
## Library Source
- Loop id: ${loop.libraryLoop.id}
- Category: ${loop.libraryLoop.category}
- Loop type: ${loop.libraryLoop.loopType ?? "goal-based"}
- Summary: ${loop.libraryLoop.summary}
`
    : "";

  return `# ${loop.name}

Status: ready
Created: ${loop.now}
Owner: agent

## Goal
${loop.goal}

## Scope
- ${loop.scope}

## Verifier Gate
- Command or criterion: ${loop.check}
- Treat the verifier as the only success gate. Do not call the loop done until this passes or the user explicitly accepts a different result.

## Iteration Protocol
1. Discover the smallest relevant context.
2. Plan the single next change or check.
3. Execute one focused step.
4. Verify with: ${loop.check}
5. Record evidence in \`.loop-it/progress.json\`.
6. Decide whether to stop or continue.

## Iteration Budget
- Max iterations: ${loop.maxIterations}
- Stop on repeated failure after: 2 attempts with no new evidence

## Stop Conditions
- ${loop.stop}

## Approval Gates
- ${loop.approval}
${librarySection}
## Evidence To Track
- Current iteration number.
- Verifier output.
- Changed files or artifacts.
- Blockers and remaining risks.
- Next decision: continue, stop, ask approval, or switch loop.

## Host Launch
See \`.loop-it/LAUNCH.md\` for the Codex, Claude Code, and Cursor launch prompts. This file is the contract; it does not repair code until an agent runs the launch prompt.

## Iteration Log

### Iteration 1
- Action:
- Verifier:
- Result:
- Decision:

## Final Report
- Outcome:
- Verifier evidence:
- Changed files or artifacts:
- Remaining risks:
- Recommended next action:
`;
}

function renderLaunchGuide(loop, options = {}) {
  const hasLocalContract = Boolean(options.hasLocalContract);
  const sections = loop.agents
    .map((name) => renderAgentLaunch(name, loop, { hasLocalContract }))
    .join("\n");
  const usageNote = hasLocalContract
    ? "Use this file to run the loop in an agent. The generated `.loop-it` files prepare the contract; the pasted launch prompt starts execution mode. A run is not successful when it only creates or edits `.loop-it` files."
    : "Use the prompt below as one self-contained normal message. Print mode does not create local Loop It state; the agent must return the requested proof in its response.";
  return `# ${loop.name} Launch

Goal: ${loop.goal}

Proof requirement: ${displayProof(loop.check, { hasLocalContract })}

Iteration cap: ${loop.maxIterations}

Stop: ${loop.stop}

${usageNote}

${sections}
`;
}

function renderAgentLaunch(agentName, loop, options = {}) {
  const hasLocalContract = Boolean(options.hasLocalContract);
  const heading = {
    codex: "Codex Launch",
    claude: "Claude Code Launch",
    cursor: "Cursor Launch",
  }[agentName];
  return `## ${heading}

Paste this as a normal message:

\`\`\`text
Run this bounded Loop It task now in the current workspace.

Goal
${plain(loop.goal)}

Scope
${plain(loop.scope)}

Proof required
${plain(displayProof(loop.check, { hasLocalContract }))}

Use at most ${loop.maxIterations} focused iterations.

Protocol
DISCOVER -> PLAN -> EXECUTE -> VERIFY -> ITERATE

Inspect the smallest relevant context and apply the proof requirement above directly. If it refers to a project verifier recorded in a local Loop It contract, run that verifier inside the agent workflow and capture the actual result. If print mode did not create a contract and the supplied proof was command-shaped, infer the narrowest safe local proof from the workspace. Make only scoped changes, and continue only when the next pass has a clear expected improvement.

Changes only to Loop It state files do not count as completing the task. Record evidence, changed files or artifacts, blockers, remaining risks, and the next safe action.

Stop when
${plain(loop.stop)}

Approval required before
${plain(loop.approval)}

Do not ask me to run or copy terminal commands. Do not publish, send external messages, deploy, purchase, change credentials, run destructive git operations, or make irreversible data changes without explicit approval.
\`\`\`

${
  hasLocalContract
    ? "The prompt starts the task. The local Loop It files remain the portable contract and evidence record."
    : "The prompt starts the task. Return the evidence in the final response because print mode did not create local Loop It state."
}`;
}

function progressState(loop) {
  return {
    activeLoopId: loop.libraryLoop?.id ?? null,
    loopName: loop.name,
    status: "ready",
    objective: loop.goal,
    scope: loop.scope,
    verifier: loop.check,
    maxIterations: Number(loop.maxIterations),
    currentIteration: 0,
    lastResult: "not-run",
    hostAgents: loop.agents,
    launchFile: ".loop-it/LAUNCH.md",
    blockers: [],
    remainingRisks: [],
    evidenceToRecord: ["iteration number", "verifier output", "changed files", "blockers", "remaining risks"],
    recommendedNextAction: "Open the generated prompt in the selected agent; changes only to Loop It state files do not count as progress.",
    updatedAt: loop.now,
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      fail(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (["force", "print", "help", "h"].includes(key)) {
      parsed[key] = true;
      continue;
    }

    const value = argv[i + 1];
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

function requiredString(value, name) {
  const result = stringArg(value, "");
  if (!result) {
    fail(`${name} is required`);
  }
  return result;
}

function positiveIntegerArg(value, fallback, name) {
  const result = stringArg(value, fallback);
  if (!/^[1-9]\d*$/.test(result)) {
    fail(`${name} must be a positive integer`);
  }
  return result;
}

function resolveAgents(value) {
  const valid = new Set(["codex", "claude", "cursor"]);
  if (value === "all") {
    return ["codex", "claude", "cursor"];
  }
  if (!valid.has(value)) {
    fail(`Unsupported agent: ${value}`);
  }
  return [value];
}

function findLibraryLoop(id) {
  const loop = findLoopById(id);
  if (!loop) {
    fail(`Unknown loop id: ${id}`);
  }
  return loop;
}

function plain(value) {
  return String(value).replaceAll("```", "'''");
}

function safePromptObjective(value, options) {
  try {
    return sanitizePromptObjective(value, options);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function displayProof(check, options = {}) {
  const proof = String(check ?? "").trim();
  if (!hasPromptCommandSyntax(proof)) {
    return proof;
  }
  if (options.hasLocalContract) {
    return "Run the project verifier recorded in the local Loop It contract inside the agent workflow and report whether it passed.";
  }
  return "Infer and run the narrowest relevant project check inside the agent workflow, then report whether it passed.";
}

function printUsage() {
  console.log(`Usage:
  start-loop.mjs --goal "Fix failing checkout tests" --check "npm test -- checkout"
  start-loop.mjs --agent codex --goal "Ship release" --check "npm run check" --max-iterations 5

Options:
  --goal <text>             Concrete objective to keep working toward
  --check <text>            Verifier command or objective success criterion
  --agent <codex|claude|cursor|all>  Host launch prompt to generate, default all
  --from <loop-id>          Seed naming and metadata from the bundled library
  --name <text>             Loop title
  --scope <text>            Repository, files, or feature area, default current working tree
  --max-iterations <n>      Iteration cap, default 5
  --stop <text>             Stop conditions
  --approval <text>         Approval gates
  --output <path>           Loop contract file, default .loop-it/LOOP.md
  --launch-output <path>    Host launch file, default .loop-it/LAUNCH.md
  --print                   Print launch prompts instead of writing files
  --force                   Replace existing output files`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
