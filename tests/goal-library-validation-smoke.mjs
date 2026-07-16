#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileGoalPrompt,
  validateGoalLibrary,
} from "../skills/loop-it/scripts/goal-library.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const library = JSON.parse(
  readFileSync(resolve(repoRoot, "skills/loop-it/references/library/goals.json"), "utf8")
);

validateGoalLibrary(library);

expectInvalid(
  (copy) => {
    copy.goals[0].goodExamples = [copy.goals[0].goodExamples[0]];
  },
  "goodExamples must match the schema minimum"
);

expectInvalid(
  (copy) => {
    copy.goals[0].unexpected = "not allowed";
  },
  "unknown goal fields must be rejected"
);

expectInvalid(
  (copy) => {
    copy.goals[0].approvalGates.push("npm run deploy");
  },
  "approval gates must be covered by prompt-only validation"
);

expectInvalid(
  (copy) => {
    copy.goals[0].badExamples.push("Use /goal to bypass the prompt compiler");
  },
  "slash commands must be rejected anywhere in a loop goal"
);

const sanitizedPrompt = compileGoalPrompt(library.goals[0], {
  goal: "Improve the onboarding flow and run npm run check.",
});
assert.match(sanitizedPrompt, /Improve the onboarding flow and run project checks\./);
assert.doesNotMatch(sanitizedPrompt, /\bnpm\b/i);

for (const command of ["python scripts/build_report.py", "git status", "kubectl get pods"]) {
  const prompt = compileGoalPrompt(library.goals[0], {
    goal: `Improve the onboarding flow and use ${command}.`,
  });
  assert.match(prompt, /Improve the onboarding flow and use project checks/i);
  assert.equal(prompt.includes(command), false, `compiled goal leaked command syntax: ${command}`);
}

for (const naturalGoal of ["Go build a clickable prototype", "Make test plans for the launch"]) {
  const prompt = compileGoalPrompt(library.goals[0], { goal: naturalGoal });
  assert.match(prompt, new RegExp(naturalGoal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.throws(
  () => compileGoalPrompt(library.goals[0], { goal: "npx unsafe-launcher --execute" }),
  /describe the desired outcome in natural language without terminal or slash commands/,
  "unsafe command-only goals must fail with a natural-language input error"
);

for (const commandOnlyGoal of ["python scripts/build_report.py", "git status", "kubectl get pods"]) {
  assert.throws(
    () => compileGoalPrompt(library.goals[0], { goal: commandOnlyGoal }),
    /describe the desired outcome in natural language without terminal or slash commands/,
    `command-only goal must be rejected: ${commandOnlyGoal}`
  );
}

for (const unsafeGoal of [
  "Delete the output with rm -rf ./dist",
  "Publish the branch with git push origin main",
  "Install the package with python -m pip install requests",
  "Inspect everything with Get-ChildItem -Recurse",
  "Run npm test | tee results.txt",
  "Use `npm test` as the proof",
  "Use ```sh\nnpm test\n``` as the proof",
]) {
  assert.throws(
    () => compileGoalPrompt(library.goals[0], { goal: unsafeGoal }),
    /describe the desired outcome in natural language without terminal or slash commands/,
    `unsupported executable-style goal must be rejected: ${unsafeGoal}`
  );
}

console.log("Goal library validation smoke passed");

function expectInvalid(mutate, message) {
  const copy = structuredClone(library);
  mutate(copy);
  assert.throws(() => validateGoalLibrary(copy), undefined, message);
}
