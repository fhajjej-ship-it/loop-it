#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recommendPrompt } from "../skills/loop-it/scripts/select-loop.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const startScript = resolve(repoRoot, "skills/loop-it/scripts/start-loop.mjs");
const proofMessage = "Use the configured proof requirement from the local Loop It contract.";
const commandChecks = [
  "make test",
  "dotnet test",
  "swift test",
  "pytest tests/unit",
];
const forbiddenPromptPatterns = [
  /\bnpx\b/i,
  /\b(?:npm|pnpm|yarn|bun)\s+(?:run|exec|test|check|build|lint)\b/i,
  /\bcodex\s+exec\b/i,
  /(?:^|\s)\/(?:goal|loop-it)\b/i,
];

for (const check of commandChecks) {
  const result = spawnSync(
    process.execPath,
    [startScript, "--goal", "Repair the failing project behavior.", "--check", check, "--agent", "codex", "--print"],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || `launch generation failed for ${check}`);
  assert.match(result.stdout, new RegExp(proofMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(result.stdout.includes(check), false, `launch leaked verifier command: ${check}`);
}

const customGoal = "prepare a finance brief and run npm test";
const customRecommendation = recommendPrompt({ goal: customGoal });
assert.equal(customRecommendation.kind, "custom");
assert.match(customRecommendation.prompt, /prepare a finance brief and run project checks/i);
assertPromptOnly(customRecommendation.prompt, "custom recommendation prompt");

const engineeringGoal = "Fix the failing checkout behavior and run npm test -- checkout";
const engineeringLaunch = spawnSync(
  process.execPath,
  [startScript, "--goal", engineeringGoal, "--check", "npm test -- checkout", "--agent", "codex", "--print"],
  { encoding: "utf8" }
);
assert.equal(engineeringLaunch.status, 0, engineeringLaunch.stderr || "engineering launch generation failed");
assert.match(engineeringLaunch.stdout, /Fix the failing checkout behavior and run project checks/i);
assertPromptOnly(engineeringLaunch.stdout, "engineering launch prompt");

const slashGoal = recommendPrompt({ goal: "/goal prepare a finance brief with cited evidence" });
assert.match(slashGoal.prompt, /prepare a finance brief with cited evidence/i);
assertPromptOnly(slashGoal.prompt, "native slash-command goal prompt");

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

console.log("Prompt-only launch smoke passed");

function assertPromptOnly(content, label) {
  for (const pattern of forbiddenPromptPatterns) {
    assert.doesNotMatch(content, pattern, `${label} leaked command syntax`);
  }
}
