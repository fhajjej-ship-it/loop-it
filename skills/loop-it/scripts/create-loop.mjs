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
const name = stringArg(args.name, defaults.name ?? "Working Loop");
const objective = stringArg(args.objective, defaults.objective ?? "<Concrete outcome>");
const check = stringArg(args.check, defaults.check ?? "<Verification command or criterion>");
const output = stringArg(args.output, ".loop-it/LOOP.md");
const maxIterations = stringArg(args["max-iterations"], defaults.maxIterations ?? "5");
const stop = stringArg(
  args.stop,
  defaults.stop ?? "success, exhausted iteration budget, repeated failure, blocked access, or approval required"
);
const approval = stringArg(
  args.approval,
  defaults.approval ??
    "production writes, external messages, destructive git operations, credentials, deploys, or irreversible data changes"
);
const now = new Date().toISOString();
const librarySection = libraryLoop
  ? `
## Library Source
- Loop id: ${libraryLoop.id}
- Category: ${libraryLoop.category}
- Summary: ${libraryLoop.summary}

## Recommended Questions
${libraryLoop.questions.slice(0, 3).map((question) => `- ${question}`).join("\n")}
`
  : "";
const trackingSection = `
## Evidence To Track
- Last check: ${check}
- Last result: pass, fail, blocked, or not-run.
- Changed files or artifacts.
- Blockers and remaining risks.
- Recommended next action: continue this loop, stop, or run \`loop-it next --cwd .\`.

## Next Loop Decision
- Continue this loop only when the next pass has a clear expected improvement.
- Stop when a stop condition is met or approval is required.
- Run \`loop-it next --cwd .\` after the loop is complete, stopped, or blocked.
`;

const content = `# ${name}

Status: draft
Created: ${now}
Owner: agent

## Objective
${objective}

## Non-goals
- Do not expand beyond the stated scope without approval.

## Scope
- Repository/path: current working tree
- Inputs: user request and inspected project files
- External systems: none unless explicitly approved

## Success Check
- Primary check: ${check}
- Supporting checks: choose the narrowest relevant lint, type-check, test, build, benchmark, or manual inspection.
- Manual review criteria: changed behavior matches the objective and does not introduce unrelated refactors.

## Iteration Budget
- Max iterations: ${maxIterations}
- Stop on repeated failure after: 2 attempts with no new evidence

## Approval Gates
- ${approval}
${librarySection}
${trackingSection}

## Loop Body
${libraryLoop ? libraryLoop.body : "1. Inspect the smallest relevant context.\n2. Make one focused change or decision.\n3. Run the success check or the narrowest useful proxy.\n4. Record evidence and remaining risk.\n5. Continue only if the next pass has a clear expected improvement."}

## Stop Conditions
- ${stop}

## Iteration Log

### Iteration 1
- Action:
- Evidence:
- Result:
- Decision:

## Final Report
- Outcome:
- Evidence:
- Changed files or artifacts:
- Remaining risks:
- Recommended next action:
`;

if (args.print) {
  process.stdout.write(content);
  process.exit(0);
}

const target = resolve(process.cwd(), output);
const progressTarget = resolve(dirname(target), "progress.json");
if (existsSync(target) && !args.force) {
  fail(`${output} already exists. Re-run with --force to replace it.`);
}

if (!args["no-progress"] && existsSync(progressTarget) && !args.force) {
  fail(`${progressTarget} already exists. Re-run with --force to replace it.`);
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, content, "utf8");

if (!args["no-progress"]) {
  writeFileSync(progressTarget, JSON.stringify(progressState(), null, 2) + "\n", "utf8");
}

console.log(`Created ${output}`);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      fail(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (["force", "print", "help", "h", "no-progress"].includes(key)) {
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

function findLibraryLoop(id) {
  const loop = findLoopById(id);
  if (!loop) {
    fail(`Unknown loop id: ${id}`);
  }
  return loop;
}

function progressState() {
  return {
    activeLoopId: libraryLoop?.id ?? null,
    loopName: name,
    status: "draft",
    objective,
    lastCheck: check,
    lastResult: "not-run",
    blockers: [],
    remainingRisks: [],
    evidenceToRecord: ["changed files", "verification output", "blockers", "remaining risks"],
    recommendedNextAction: "Run the first loop iteration, then update this progress file.",
    nextLoopCommand: "loop-it next --cwd .",
    updatedAt: now,
  };
}

function printUsage() {
  console.log(`Usage:
  create-loop.mjs --name "Docs sweep" --objective "Update stale docs" --check "npm test"
  create-loop.mjs --from failing-ci-repair

Options:
  --from <loop-id>          Use a loop from the bundled library
  --name <text>             Loop title
  --objective <text>        Concrete outcome
  --check <text>            Verification command or criterion
  --max-iterations <n>      Iteration cap, default 5
  --stop <text>             Stop conditions
  --approval <text>         Approval gates
  --output <path>           Output file, default .loop-it/LOOP.md
  --print                   Print markdown instead of writing a file
  --no-progress             Do not write progress.json beside the loop file
  --force                   Replace an existing output file`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
