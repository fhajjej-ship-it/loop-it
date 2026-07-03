#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { findLoopById, loopDefaults } from "./select-loop.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printUsage();
  process.exit(0);
}

const libraryLoop = args.from ? findLibraryLoop(args.from) : null;
const defaults = libraryLoop ? loopDefaults(libraryLoop) : {};
const goal = requiredString(args.goal, "--goal");
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
const launchContent = renderLaunchGuide(contract);
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

function renderLaunchGuide(loop) {
  const sections = loop.agents.map((name) => renderAgentLaunch(name, loop)).join("\n");
  return `# ${loop.name} Launch

Goal: ${loop.goal}

Verifier: ${loop.check}

Iteration cap: ${loop.maxIterations}

Stop: ${loop.stop}

Use this file to run the loop in an agent. The generated \`.loop-it\` files prepare the contract; the pasted launch prompt starts execution mode. A run is not successful when it only creates or edits \`.loop-it\` files.

${sections}
`;
}

function renderAgentLaunch(agentName, loop) {
  if (agentName === "codex") {
    return `## Codex Launch

Paste this into Codex as a normal message:

\`\`\`text
Use $loop-it if this Codex workspace has the Loop It skill or plugin enabled. If not, run the bounded task directly from this prompt.

Goal: ${plain(loop.goal)}
Done only when the verifier passes, or when ${loop.maxIterations} iterations are reached.

Run The Loop mode. You are not being asked to create another loop.
Read .loop-it/LOOP.md as state, then execute the repair. Do not run loop-it write, loop-it new, or loop-it start.
First action: run the verifier, or the closest available equivalent, and capture the actual failure.
If the verifier fails, inspect the target repo, make the smallest credible change when needed, and rerun the verifier.
Changes only under .loop-it do not count as a successful iteration. If you only updated loop files, keep going.
Scope: ${plain(loop.scope)}
Verifier: ${plain(loop.check)}
Protocol: DISCOVER -> PLAN -> EXECUTE -> VERIFY -> ITERATE.
After each iteration, run the verifier, record evidence in .loop-it/progress.json, and continue only if the next pass has a clear expected improvement.
Stop when: ${plain(loop.stop)}
Approval required for: ${plain(loop.approval)}
\`\`\`

If nothing starts after pasting this, send a follow-up message: "Run the loop now from the prompt above."`;
  }

  if (agentName === "claude") {
    return `## Claude Code Launch

Paste this into Claude Code as a normal message:

\`\`\`text
Use /loop-it if this Claude Code workspace has the Loop It skill installed. If not, run the bounded task directly from this prompt.

Goal: ${plain(loop.goal)}
Done only when the verifier passes, or when ${loop.maxIterations} iterations are reached.

Run The Loop mode. You are not being asked to create another loop.
Read .loop-it/LOOP.md as state, then execute the repair. Do not run loop-it write, loop-it new, or loop-it start.
First action: run the verifier, or the closest available equivalent, and capture the actual failure.
If the verifier fails, inspect the target repo, make the smallest credible change when needed, and rerun the verifier.
Changes only under .loop-it do not count as a successful iteration. If you only updated loop files, keep going.
Scope: ${plain(loop.scope)}
Verifier: ${plain(loop.check)}
Protocol: DISCOVER -> PLAN -> EXECUTE -> VERIFY -> ITERATE.
After each iteration, run the verifier, record evidence in .loop-it/progress.json, and continue only if the next pass has a clear expected improvement.
Stop when: ${plain(loop.stop)}
Approval required for: ${plain(loop.approval)}
\`\`\`

Use Claude Code \`/loop\` only for polling or interval work. For finish-line work with a verifier, run this as a bounded goal with proof.`;
  }

  return `## Cursor Launch

Paste this into Cursor Agent chat as a normal message:

\`\`\`text
Use /loop-it if this Cursor workspace has the Loop It skill installed. If not, run the bounded task directly from this prompt.

Run The Loop mode. You are not being asked to create another loop.
Read .loop-it/LOOP.md as state, then execute the repair. Do not run loop-it write, loop-it new, or loop-it start.
First action: run the verifier, or the closest available equivalent, and capture the actual failure.
If the verifier fails, inspect the target repo, make the smallest credible change when needed, and rerun the verifier.
Changes only under .loop-it do not count as a successful iteration. If you only updated loop files, keep going.
Goal: ${plain(loop.goal)}
Scope: ${plain(loop.scope)}
Verifier: ${plain(loop.check)}
Iteration cap: ${loop.maxIterations}
Protocol: DISCOVER -> PLAN -> EXECUTE -> VERIFY -> ITERATE.
After each iteration, run the verifier, record evidence in .loop-it/progress.json, and continue only if the next pass has a clear expected improvement.
Stop when: ${plain(loop.stop)}
Approval required for: ${plain(loop.approval)}
\`\`\`

Cursor Agent chat should treat this as the verifier-gated task contract. Loop It supplies the durable state, stop rules, and evidence requirements.`;
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
    recommendedNextAction: "Paste a host launch prompt from .loop-it/LAUNCH.md into the target agent to run the repair; .loop-it-only changes do not count as progress.",
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
