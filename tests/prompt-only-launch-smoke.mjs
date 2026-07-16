#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recommendPrompt } from "../skills/loop-it/scripts/select-loop.mjs";
import { assertUserFacingPromptOnly } from "./helpers/prompt-only.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const startScript = resolve(repoRoot, "skills/loop-it/scripts/start-loop.mjs");
const runScript = resolve(repoRoot, "skills/loop-it/scripts/run-loop.mjs");
const generalizedProof = "Infer and run the narrowest relevant project check inside the agent workflow, then report whether it passed.";
const commandChecks = [
  "make test",
  "dotnet test",
  "swift test",
  "pytest tests/unit",
  "python scripts/build_report.py",
  "git status",
  "kubectl get pods",
  "rm -rf ./dist",
  "git push origin main",
  "python -m pip install requests",
  "Get-ChildItem -Recurse",
  "npm test | tee results.txt",
];
for (const check of commandChecks) {
  const result = spawnSync(
    process.execPath,
    [startScript, "--goal", "Repair the failing project behavior.", "--check", check, "--agent", "codex", "--print"],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || `launch generation failed for ${check}`);
  assert.match(result.stdout, new RegExp(generalizedProof.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(result.stdout.includes(check), false, `launch leaked verifier command: ${check}`);
  assert.doesNotMatch(result.stdout, /configured proof requirement from the local Loop It contract/i);
}

const naturalProof = "Every recommendation cites a source and names a decision owner.";
const naturalProofLaunch = spawnSync(
  process.execPath,
  [startScript, "--goal", "Prepare a decision brief.", "--check", naturalProof, "--agent", "codex", "--print"],
  { encoding: "utf8" }
);
assert.equal(naturalProofLaunch.status, 0, naturalProofLaunch.stderr || "natural proof launch generation failed");
assert.match(naturalProofLaunch.stdout, new RegExp(naturalProof.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(naturalProofLaunch.stdout, /Print mode does not create local Loop It state/i);
assertUserFacingPromptOnly(naturalProofLaunch.stdout, "natural proof launch prompt");

const customGoal = "prepare a finance brief and run npm test";
const customRecommendation = recommendPrompt({ goal: customGoal });
assert.equal(customRecommendation.kind, "custom");
assert.match(customRecommendation.prompt, /prepare a finance brief and run project checks/i);
assertUserFacingPromptOnly(customRecommendation.prompt, "custom recommendation prompt");

const engineeringGoal = "Fix the failing checkout behavior and run npm test -- checkout";
const engineeringLaunch = spawnSync(
  process.execPath,
  [startScript, "--goal", engineeringGoal, "--check", "npm test -- checkout", "--agent", "codex", "--print"],
  { encoding: "utf8" }
);
assert.equal(engineeringLaunch.status, 0, engineeringLaunch.stderr || "engineering launch generation failed");
assert.match(engineeringLaunch.stdout, /Fix the failing checkout behavior and run project checks/i);
assertUserFacingPromptOnly(engineeringLaunch.stdout, "engineering launch prompt");

const slashGoal = recommendPrompt({ goal: "/goal prepare a finance brief with cited evidence" });
assert.match(slashGoal.prompt, /prepare a finance brief with cited evidence/i);
assertUserFacingPromptOnly(slashGoal.prompt, "native slash-command goal prompt");

const releaseGoal = "Prepare version 0.4.0 for release with final package checks and fresh-install proof.";
const releaseRecommendation = recommendPrompt({ goal: releaseGoal });
assert.equal(releaseRecommendation.kind, "loop");
assert.equal(releaseRecommendation.selected?.loop?.id, "release-readiness");
assert.match(releaseRecommendation.workflow.prompt, new RegExp(releaseGoal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assertUserFacingPromptOnly(releaseRecommendation.workflow.prompt, "advanced-loop recommendation prompt");

const unsafeLaunch = spawnSync(
  process.execPath,
  [startScript, "--goal", "npx unsafe-launcher --execute", "--check", "npm test", "--agent", "codex", "--print"],
  { encoding: "utf8" }
);
assert.notEqual(unsafeLaunch.status, 0, "unsafe command-only goals must be rejected");
assert.match(
  unsafeLaunch.stderr,
  /describe the desired outcome in natural language without terminal or slash commands/
);
assert.doesNotMatch(unsafeLaunch.stderr, /\n\s+at\s/, "friendly rejection must not expose a stack trace");

const unsafeRun = spawnSync(
  process.execPath,
  [runScript, "--goal", "Publish with git push origin main", "--json"],
  { encoding: "utf8" }
);
assert.notEqual(unsafeRun.status, 0, "run routing must reject unsafe command goals");
assert.match(
  unsafeRun.stderr,
  /^Error: Goal must describe the desired outcome in natural language without terminal or slash commands\./
);
assert.doesNotMatch(unsafeRun.stderr, /\n\s+at\s/, "run rejection must not expose a stack trace");

const normalRun = spawnSync(
  process.execPath,
  [runScript, "--goal", "Prepare a decision brief with cited evidence."],
  { encoding: "utf8" }
);
assert.equal(normalRun.status, 0, normalRun.stderr || "normal prompt routing failed");
assert.match(normalRun.stdout, /Prepare a decision brief with cited evidence\./i);
assertUserFacingPromptOnly(normalRun.stdout, "normal run prompt");

console.log("Prompt-only launch smoke passed");
