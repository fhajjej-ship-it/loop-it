#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printUsage();
  process.exit(0);
}

const name = stringArg(args.name, "Working Loop");
const objective = stringArg(args.objective, "<Concrete outcome>");
const check = stringArg(args.check, "<Verification command or criterion>");
const output = stringArg(args.output, ".loop-it/LOOP.md");
const maxIterations = stringArg(args["max-iterations"], "5");
const stop = stringArg(
  args.stop,
  "success, exhausted iteration budget, repeated failure, blocked access, or approval required"
);
const approval = stringArg(
  args.approval,
  "production writes, external messages, destructive git operations, credentials, deploys, or irreversible data changes"
);
const now = new Date().toISOString();

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

## Loop Body
1. Inspect the smallest relevant context.
2. Make one focused change or decision.
3. Run the success check or the narrowest useful proxy.
4. Record evidence and remaining risk.
5. Continue only if the next pass has a clear expected improvement.

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
if (existsSync(target) && !args.force) {
  fail(`${output} already exists. Re-run with --force to replace it.`);
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, content, "utf8");
console.log(`Created ${output}`);

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

function printUsage() {
  console.log(`Usage:
  create-loop.mjs --name "Docs sweep" --objective "Update stale docs" --check "npm test"

Options:
  --name <text>             Loop title
  --objective <text>        Concrete outcome
  --check <text>            Verification command or criterion
  --max-iterations <n>      Iteration cap, default 5
  --stop <text>             Stop conditions
  --approval <text>         Approval gates
  --output <path>           Output file, default .loop-it/LOOP.md
  --print                   Print markdown instead of writing a file
  --force                   Replace an existing output file`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
