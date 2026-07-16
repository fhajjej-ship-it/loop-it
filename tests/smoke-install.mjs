#!/usr/bin/env node
import {
  existsSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillSource = resolve(repoRoot, "skills", "loop-it");
const libraryEvalsPath = resolve(skillSource, "references", "library", "evals.json");
const goalLibraryPath = resolve(skillSource, "references", "library", "goals.json");
const goalLibraryScriptPath = resolve(skillSource, "scripts", "goal-library.mjs");
const nodeBin = process.execPath;
const cliPath = resolve(repoRoot, "bin", "loop-it.mjs");
const tempRoot = mkdtempSync(resolve(tmpdir(), "loop-it-smoke-"));
const allowedLoopTypes = new Set(["turn-based", "goal-based", "time-based", "proactive"]);
const forbiddenUserPromptPatterns = [
  ["npx", /\bnpx\b/i],
  ["npm run", /\bnpm\s+run\b/i],
  ["loop-it start/write/run", /\bloop-it\s+(?:start|write|run)\b/i],
  ["codex exec", /\bcodex\s+exec\b/i],
  ["/goal", /\/goal\b/i],
];

try {
  smokePackageMetadata();
  smokeProjectInstall();
  smokeGoalLibrary();
  smokeLibrarySelection();
  smokeLoopFileCreation();
  smokeLoopWriting();
  smokeLoopStart();
  smokeLoopRun();
  smokeLoopExecute();
  smokeScheduledRunner();
  smokeDoctor();
  smokeGitHubConnector();
  smokePackedCli();
  console.log("Smoke install checks passed");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function smokePackageMetadata() {
  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  for (const file of [
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
    ".cursor-plugin/plugin.json",
  ]) {
    const metadata = JSON.parse(readFileSync(resolve(repoRoot, file), "utf8"));
    if (metadata.version !== packageJson.version) {
      fail(`Expected ${file} version ${metadata.version} to match package.json version ${packageJson.version}`);
    }
  }
}

function smokeProjectInstall() {
  const projectDir = resolve(tempRoot, "project-install");
  mkdirSync(projectDir, { recursive: true });
  run(nodeBin, [cliPath, "install", "--agent", "all", "--scope", "project", "--cwd", projectDir]);

  for (const target of [
    ".agents/skills/loop-it/SKILL.md",
    ".claude/skills/loop-it/SKILL.md",
    ".cursor/skills/loop-it/SKILL.md",
    ".agents/skills/loop-it/references/loop-template.md",
    ".agents/skills/loop-it/references/library/loops.json",
    ".agents/skills/loop-it/references/library/evals.json",
    ".agents/skills/loop-it/references/library/goals.json",
    ".agents/skills/loop-it/references/library/goals-schema.json",
    ".agents/skills/loop-it/references/library/goals-evals.json",
    ".agents/skills/loop-it/scripts/select-loop.mjs",
    ".agents/skills/loop-it/scripts/goal-library.mjs",
    ".agents/skills/loop-it/scripts/create-loop.mjs",
    ".agents/skills/loop-it/scripts/start-loop.mjs",
    ".agents/skills/loop-it/scripts/run-loop.mjs",
    ".agents/skills/loop-it/scripts/schedule-loop.mjs",
    ".agents/skills/loop-it/scripts/github-connector.mjs",
    ".agents/skills/loop-it/scripts/doctor.mjs",
  ]) {
    assertFile(resolve(projectDir, target));
  }

  for (const target of [
    ".agents/skills/loop-it",
    ".claude/skills/loop-it",
    ".cursor/skills/loop-it",
  ]) {
    assertDirectoryMatches(skillSource, resolve(projectDir, target));
  }

  const duplicate = spawnSync(nodeBin, [cliPath, "install", "--agent", "codex", "--scope", "project", "--cwd", projectDir], {
    encoding: "utf8",
  });
  if (duplicate.status === 0) {
    fail("Expected duplicate install without --force to fail");
  }

  run(nodeBin, [cliPath, "install", "--agent", "codex", "--scope", "project", "--cwd", projectDir, "--force"]);
}

function smokeGoalLibrary() {
  const library = JSON.parse(readFileSync(goalLibraryPath, "utf8"));
  const expectedCategories = new Map([
    ["product-ux", "Product & UX"],
    ["design-prototyping", "Design & Prototyping"],
    ["research-decisions", "Research & Decisions"],
    ["content-messaging", "Content & Messaging"],
    ["data-evaluation", "Data & Evaluation"],
    ["operations-support", "Operations & Support"],
  ]);
  if (!Array.isArray(library.categories) || library.categories.length !== 6) {
    fail(`Expected goal library to include exactly 6 categories, found ${library.categories?.length ?? 0}`);
  }
  if (!Array.isArray(library.goals) || library.goals.length !== 12) {
    fail(`Expected Loop goals library to include exactly 12 goals, found ${library.goals?.length ?? 0}`);
  }

  const categoryIds = new Set();
  const goalsPerCategory = new Map();
  for (const category of library.categories) {
    if (categoryIds.has(category.id)) {
      fail(`Expected unique goal category ids, found duplicate ${category.id}`);
    }
    categoryIds.add(category.id);
    goalsPerCategory.set(category.id, 0);
    if (expectedCategories.get(category.id) !== category.title) {
      fail(`Expected canonical category ${category.id} to use title ${expectedCategories.get(category.id)}`);
    }
  }
  for (const categoryId of expectedCategories.keys()) {
    if (!categoryIds.has(categoryId)) {
      fail(`Expected Loop goals library to include category ${categoryId}`);
    }
  }

  const goalIds = new Set();
  for (const goal of library.goals) {
    if (goalIds.has(goal.id)) {
      fail(`Expected unique goal ids, found duplicate ${goal.id}`);
    }
    goalIds.add(goal.id);
    if (!categoryIds.has(goal.category)) {
      fail(`Expected ${goal.id} to reference a known category, got ${goal.category}`);
    }
    goalsPerCategory.set(goal.category, (goalsPerCategory.get(goal.category) ?? 0) + 1);

    const inputIds = new Set();
    for (const input of goal.requiredInputs ?? []) {
      if (inputIds.has(input.id)) {
        fail(`Expected ${goal.id} input ids to be unique, found duplicate ${input.id}`);
      }
      inputIds.add(input.id);
    }

    const compiled = run(nodeBin, [goalLibraryScriptPath, "compile", "--id", goal.id]).stdout;
    for (const text of [
      "Use this goal",
      "review-ready deliverable",
      "rubric evidence or a clear blocker",
      goal.defaultGoal,
      goal.expectedArtifact,
      "Expected deliverable",
      "Proof rubric",
      "Evidence to return",
    ]) {
      assertIncludes(compiled, text, `${goal.id} compiled prompt`);
    }
    assertUserFacingPromptOnly(compiled, `${goal.id} compiled prompt`);
  }

  if (!goalIds.has("clickable-flow-prototype")) {
    fail("Expected Clickable Flow Prototype to use the canonical clickable-flow-prototype id");
  }

  for (const [categoryId, count] of goalsPerCategory) {
    if (count !== 2) {
      fail(`Expected category ${categoryId} to include exactly 2 loop goals, found ${count}`);
    }
  }

  const evalReport = JSON.parse(run(nodeBin, [goalLibraryScriptPath, "eval", "--json"]).stdout);
  if (!evalReport.ok || evalReport.failed !== 0 || evalReport.missingGoalIds.length !== 0) {
    fail("Expected goal library eval scenarios to pass and cover every loop goal");
  }

  const creativeGoal = "turn this article into a LinkedIn draft in our brand voice";
  const recommendation = JSON.parse(
    run(nodeBin, [cliPath, "recommend", "--goal", creativeGoal, "--json"]).stdout
  );
  if (
    recommendation.kind !== "goal-template" ||
    recommendation.selected?.goal?.id !== "source-to-content-pack" ||
    recommendation.selected?.confidence === "low"
  ) {
    fail("Expected a creative content request to recommend source-to-content-pack with usable confidence");
  }
  if (typeof recommendation.prompt !== "string" || !recommendation.prompt.includes(creativeGoal)) {
    fail("Expected creative recommendation to include a compiled, goal-specific prompt");
  }
  assertUserFacingPromptOnly(recommendation.prompt, "creative recommendation prompt");

  const promptOnlyProject = resolve(tempRoot, "creative-goal-prompt-only");
  mkdirSync(promptOnlyProject, { recursive: true });
  const promptPlan = JSON.parse(
    run(nodeBin, [cliPath, "run", "--goal", creativeGoal, "--cwd", promptOnlyProject, "--json"]).stdout
  );
  if (
    promptPlan.kind !== "goal-template" ||
    promptPlan.action !== "prompt-ready" ||
    promptPlan.goalTemplateId !== "source-to-content-pack" ||
    promptPlan.canExecuteUnattended !== false
  ) {
    fail("Expected creative run routing to return a prompt-ready, interactive goal plan");
  }
  assertUserFacingPromptOnly(promptPlan.prompt, "creative run prompt plan");
  if (existsSync(resolve(promptOnlyProject, ".loop-it"))) {
    fail("Expected creative prompt routing not to create repository loop state");
  }

  const refusedExecution = spawnSync(
    nodeBin,
    [cliPath, "run", "--goal", creativeGoal, "--cwd", promptOnlyProject, "--execute", "codex"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  if (refusedExecution.status !== 2 || !refusedExecution.stdout.includes("ready as an interactive prompt")) {
    fail("Expected unattended creative execution to stop with a prompt-ready result");
  }
  assertUserFacingPromptOnly(refusedExecution.stdout, "refused creative execution prompt");
  if (existsSync(resolve(promptOnlyProject, ".loop-it"))) {
    fail("Expected refused creative execution not to create repository loop state");
  }

  const refusedJsonExecution = spawnSync(
    nodeBin,
    [cliPath, "run", "--goal", creativeGoal, "--cwd", promptOnlyProject, "--execute", "codex", "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  if (refusedJsonExecution.status !== 2) {
    fail("Expected JSON creative execution refusal to return the same nonzero status as text mode");
  }
  const refusedJsonPlan = JSON.parse(refusedJsonExecution.stdout);
  if (refusedJsonPlan.kind !== "goal-template" || refusedJsonPlan.canExecuteUnattended !== false) {
    fail("Expected JSON creative execution refusal to return a prompt-ready goal plan");
  }
  assertUserFacingPromptOnly(refusedJsonPlan.prompt, "refused JSON creative execution prompt");

  const engineeringOverlapGoal = "fix data quality validation test";
  const engineeringRecommendation = JSON.parse(
    run(nodeBin, [cliPath, "recommend", "--goal", engineeringOverlapGoal, "--json"]).stdout
  );
  if (
    engineeringRecommendation.kind !== "loop" ||
    engineeringRecommendation.selected?.loop?.id !== "ticket-to-verified-fix" ||
    engineeringRecommendation.selected?.confidence === "low"
  ) {
    fail("Expected explicit test-repair intent to bypass overlapping creative loop goals");
  }
  assertUserFacingPromptOnly(engineeringRecommendation.workflow?.prompt ?? "", "engineering overlap prompt");

  writeFileSync(
    resolve(promptOnlyProject, "package.json"),
    JSON.stringify({ scripts: { test: "node test.mjs" } }, null, 2)
  );
  const engineeringRunPlan = JSON.parse(
    run(nodeBin, [cliPath, "run", "--goal", engineeringOverlapGoal, "--cwd", promptOnlyProject, "--json"]).stdout
  );
  if (engineeringRunPlan.kind || engineeringRunPlan.selectedLoopId !== "ticket-to-verified-fix") {
    fail("Expected run routing to keep explicit test-repair intent in the engineering loop path");
  }

  const unmatchedGoal = "prepare a concise finance brief with cited evidence";
  const customRecommendation = JSON.parse(
    run(nodeBin, [cliPath, "recommend", "--goal", unmatchedGoal, "--json"]).stdout
  );
  if (
    customRecommendation.kind !== "custom" ||
    customRecommendation.selected !== null ||
    !customRecommendation.prompt?.includes(unmatchedGoal)
  ) {
    fail("Expected an unmatched request to return a safe custom prompt instead of a low-confidence engineering loop");
  }
  assertUserFacingPromptOnly(customRecommendation.prompt, "unmatched custom recommendation prompt");

  const customRunPlan = JSON.parse(
    run(nodeBin, [cliPath, "run", "--goal", unmatchedGoal, "--cwd", promptOnlyProject, "--json"]).stdout
  );
  if (
    customRunPlan.kind !== "custom" ||
    customRunPlan.action !== "prompt-ready" ||
    customRunPlan.canExecuteUnattended !== false
  ) {
    fail("Expected unmatched run routing to return a prompt-ready custom plan");
  }
  assertUserFacingPromptOnly(customRunPlan.prompt, "unmatched custom run prompt");
  if (existsSync(resolve(promptOnlyProject, ".loop-it"))) {
    fail("Expected custom prompt routing not to create repository loop state");
  }
}

function smokeLibrarySelection() {
  const list = JSON.parse(run(nodeBin, [cliPath, "library", "list", "--json"]).stdout);
  if (!Array.isArray(list.loops) || list.loops.length < 15) {
    fail("Expected bundled loop library to include at least 15 loops");
  }

  const loopTypeCounts = Object.fromEntries([...allowedLoopTypes].map((loopType) => [loopType, 0]));
  for (const loop of list.loops) {
    if (!allowedLoopTypes.has(loop.loopType)) {
      fail(`Expected ${loop.id} to include a valid loopType`);
    }
    loopTypeCounts[loop.loopType] += 1;
    for (const field of ["requiredSignals", "goodExamples", "badExamples", "exampleChecks", "commonMisroutes"]) {
      if (!Array.isArray(loop[field]) || loop[field].length === 0) {
        fail(`Expected ${loop.id} to include non-empty ${field}`);
      }
    }
    assertReliabilityMetadata(loop);
    assertUserGuideMetadata(loop);
  }
  for (const loopType of allowedLoopTypes) {
    if (loopTypeCounts[loopType] !== 5) {
      fail(`Expected bundled loop library to include exactly 5 ${loopType} loops, found ${loopTypeCounts[loopType]}`);
    }
  }

  const search = JSON.parse(run(nodeBin, [cliPath, "library", "search", "failing ci", "--json"]).stdout);
  if (search.results?.[0]?.loop?.id !== "failing-ci-repair") {
    fail("Expected failing-ci-repair to be the top result for failing ci");
  }
  if (!["high", "medium"].includes(search.results?.[0]?.confidence)) {
    fail("Expected failing-ci-repair search to include usable confidence");
  }

  const recommendation = JSON.parse(
    run(nodeBin, [cliPath, "recommend", "--goal", "fix failing checkout test", "--json"]).stdout
  );
  if (recommendation.selected?.loop?.id !== "failing-ci-repair") {
    fail("Expected failing-ci-repair recommendation for a failing checkout test");
  }
  if (!recommendation.decision?.confidence || !Array.isArray(recommendation.decision?.whyNotAlternatives)) {
    fail("Expected recommendations to include decision confidence and alternative rationale");
  }
  if (typeof recommendation.workflow?.prompt !== "string") {
    fail("Expected engineering recommendations to include a generated workflow prompt");
  }
  assertUserFacingPromptOnly(recommendation.workflow.prompt, "engineering recommendation prompt");
  const showOutput = run(nodeBin, [cliPath, "library", "show", "failing-ci-repair"]).stdout;
  for (const text of ["Type: goal-based", "Plain English:", "Use when:", "Start with:", "First step:", "Proof tip:", "Not for:"]) {
    if (!showOutput.includes(text)) {
      fail(`Expected library show output to include ${JSON.stringify(text)}`);
    }
  }

  const evalReport = JSON.parse(run(nodeBin, [cliPath, "library", "eval", "--json"]).stdout);
  if (!evalReport.ok || evalReport.failed !== 0 || evalReport.missingLoopIds.length !== 0) {
    fail("Expected bundled library eval scenarios to pass and cover every loop");
  }

  for (const [goal, expectedLoopId] of [
    ["publish npm package", "release-readiness"],
    ["fix stale installed skill copies", "release-readiness"],
    ["explain how checkout auth flow works without editing code", "code-path-explanation"],
    ["watch my PR every 10 minutes and address new review comments", "pr-review-watch"],
    ["turn customer feedback messages into fixes or tickets automatically", "customer-feedback-action-routine"],
    ["sanitize unsafe user input", "security-hardening"],
    ["inspect this repo and run the right loop", "codebase-intake-to-running-loop"],
  ]) {
    assertRecommendedLoop(goal, expectedLoopId);
  }

  const evals = JSON.parse(readFileSync(libraryEvalsPath, "utf8"));
  const evalLoopIds = new Set();
  for (const scenario of evals.scenarios ?? []) {
    assertRecommendedLoop(scenario.goal, scenario.expectedLoopId);
    evalLoopIds.add(scenario.expectedLoopId);
  }
  for (const loop of list.loops) {
    if (!evalLoopIds.has(loop.id)) {
      fail(`Expected library eval scenarios to cover ${loop.id}`);
    }
  }

  const projectDir = resolve(tempRoot, "next-from-progress");
  const loopDir = resolve(projectDir, ".loop-it");
  mkdirSync(loopDir, { recursive: true });
  writeFileSync(
    resolve(loopDir, "progress.json"),
    JSON.stringify(
      {
        activeLoopId: "release-readiness",
        loopName: "Release readiness",
        status: "active",
        objective: "Prepare a public package release",
        lastCheck: "npm run check",
        lastResult: "not-run",
        blockers: [],
        remainingRisks: [],
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  const next = JSON.parse(run(nodeBin, [cliPath, "next", "--cwd", projectDir, "--json"]).stdout);
  if (next.selected?.loop?.id !== "release-readiness") {
    fail("Expected next to continue the active release-readiness loop");
  }

  const scheduledProjectDir = resolve(tempRoot, "next-from-scheduled-custom-progress");
  writeProgress(scheduledProjectDir, {
    activeLoopId: "weekly-adoption-review",
    loopName: "Weekly adoption review",
    status: "scheduled",
    objective: "Review adoption signals weekly",
    lastCheck: "read-only adoption evidence",
    lastResult: "pass",
    blockers: [],
    remainingRisks: ["Wait for a complete weekly evidence window"],
    recommendedNextAction: "Wait for the scheduled adoption review on Friday at 09:00",
  });
  const scheduledNext = run(nodeBin, [cliPath, "next", "--cwd", scheduledProjectDir]).stdout;
  for (const text of [
    "Active progress: Weekly adoption review (scheduled)",
    "Next action: Wait for the scheduled adoption review on Friday at 09:00",
    "No new loop recommended.",
  ]) {
    if (!scheduledNext.includes(text)) {
      fail(`Expected scheduled custom progress output to include ${JSON.stringify(text)}`);
    }
  }
  if (scheduledNext.includes("Recommended loop:")) {
    fail("Expected scheduled custom progress not to invent a new loop recommendation");
  }
  const scheduledNextJson = JSON.parse(
    run(nodeBin, [cliPath, "next", "--cwd", scheduledProjectDir, "--json"]).stdout
  );
  if (
    scheduledNextJson.selected !== null ||
    scheduledNextJson.progressResolution?.state !== "scheduled" ||
    scheduledNextJson.progressResolution?.nextAction !==
      "Wait for the scheduled adoption review on Friday at 09:00"
  ) {
    fail("Expected scheduled custom progress JSON to preserve the recorded next action without selecting a loop");
  }

  const completedScheduleProjectDir = resolve(tempRoot, "next-from-completed-schedule-progress");
  writeProgress(completedScheduleProjectDir, {
    activeLoopId: "docs-freshness-watch",
    loopName: "Docs freshness watch",
    scheduleId: "docs-freshness-watch",
    status: "completed",
    objective: "Check docs freshness after releases",
    lastCheck: "npm run check",
    lastResult: "pass",
    blockers: [],
    remainingRisks: [],
    recommendedNextAction: "Wait until 2026-07-12T04:33:32.031Z for the next scheduled tick.",
  });
  const completedScheduleNext = run(
    nodeBin,
    [cliPath, "next", "--cwd", completedScheduleProjectDir]
  ).stdout;
  for (const text of [
    "Active progress: Docs freshness watch (completed)",
    "Next action: Wait until 2026-07-12T04:33:32.031Z for the next scheduled tick.",
    "No new loop recommended.",
  ]) {
    if (!completedScheduleNext.includes(text)) {
      fail(`Expected completed schedule output to include ${JSON.stringify(text)}`);
    }
  }
  if (completedScheduleNext.includes("Recommended loop:")) {
    fail("Expected completed schedule progress not to invent a new loop recommendation");
  }

  const blockedProjectDir = resolve(tempRoot, "next-from-blocked-progress");
  writeProgress(blockedProjectDir, {
    activeLoopId: "failing-ci-repair",
    loopName: "Failing CI repair",
    status: "blocked",
    objective: "Fix the failing checkout test",
    lastCheck: "npm test -- checkout",
    lastResult: "blocked",
    blockers: ["Need regression coverage before more code changes"],
    remainingRisks: ["Checkout edge case lacks focused tests"],
    recommendedNextAction: "Add focused test coverage around the checkout regression",
  });
  const blockedNext = JSON.parse(run(nodeBin, [cliPath, "next", "--cwd", blockedProjectDir, "--json"]).stdout);
  if (blockedNext.selected?.loop?.id !== "small-edit-verification") {
    fail("Expected blocked progress to recommend small-edit-verification");
  }
  if (blockedNext.selected?.loop?.id === "failing-ci-repair") {
    fail("Expected blocked progress not to continue the blocked active loop");
  }
  if (typeof blockedNext.workflow?.prompt !== "string") {
    fail("Expected blocked progress recommendation to include a generated workflow prompt");
  }
  assertUserFacingPromptOnly(blockedNext.workflow.prompt, "blocked progress recommendation prompt");

  const completedProjectDir = resolve(tempRoot, "next-from-completed-progress");
  writeProgress(completedProjectDir, {
    activeLoopId: "release-readiness",
    loopName: "Release readiness",
    status: "completed",
    objective: "Prepare package release",
    lastCheck: "npm run check",
    lastResult: "pass",
    blockers: [],
    remainingRisks: ["Setup docs may be stale after release"],
    recommendedNextAction: "Run a docs sweep for setup commands and examples",
  });
  const completedNext = JSON.parse(run(nodeBin, [cliPath, "next", "--cwd", completedProjectDir, "--json"]).stdout);
  if (completedNext.selected?.loop?.id !== "docs-freshness-watch") {
    fail("Expected completed progress to recommend docs-freshness-watch");
  }
  if (completedNext.selected?.loop?.id === "release-readiness") {
    fail("Expected completed progress not to continue the completed active loop");
  }

  const staleReleaseProjectDir = resolve(tempRoot, "next-from-stale-release-progress");
  mkdirSync(staleReleaseProjectDir, { recursive: true });
  writeFileSync(
    resolve(staleReleaseProjectDir, "package.json"),
    JSON.stringify(
      {
        name: "@fhajjej/loop-it",
        version: "0.3.7",
      },
      null,
      2
    )
  );
  writeProgress(staleReleaseProjectDir, {
    activeLoopId: "release-readiness",
    loopName: "Release readiness",
    status: "blocked",
    objective:
      "Ship Loop It 0.3.1 as a patch release containing the skill-sync guardrails, so GitHub, npm, and generated host installs all follow one source of truth.",
    verifier:
      "npm run check && test \"$(npm view @fhajjej/loop-it version)\" = \"0.3.1\"",
    lastResult: "blocked",
    iterations: [
      {
        iteration: 1,
        phase: "PUBLISH",
        result: "blocked",
        outputSummary:
          "The 0.3.1 release commit was pushed. npm publish was blocked by npm EOTP. npm view @fhajjej/loop-it version still returns 0.3.0.",
      },
    ],
    blockers: ["Need current npm OTP/browser publish authentication for account fhajjej."],
    remainingRisks: ["npm latest remains 0.3.0 until the OTP-authenticated publish succeeds."],
    recommendedNextAction: "Run npm publish --access public with the current OTP, then rerun the public npx verifier.",
    updatedAt: "2026-06-29T12:07:46Z",
  });
  const staleReleaseNext = JSON.parse(
    run(nodeBin, [cliPath, "next", "--cwd", staleReleaseProjectDir, "--json"], {
      env: {
        LOOP_IT_SKIP_NPM_VIEW: "1",
      },
    }).stdout
  );
  if (staleReleaseNext.selected?.loop?.id !== "codebase-intake-to-running-loop") {
    fail("Expected stale resolved release progress to recommend a fresh intake loop");
  }
  if (staleReleaseNext.selected?.loop?.id === "release-readiness") {
    fail("Expected stale resolved release progress not to continue release-readiness");
  }
  if (staleReleaseNext.progressResolution?.state !== "stale-resolved") {
    fail("Expected stale release progress to include stale-resolved progressResolution");
  }
  if (staleReleaseNext.progressResolution?.targetVersion !== "0.3.1") {
    fail("Expected stale release progress to resolve the old 0.3.1 target");
  }
  if (staleReleaseNext.progressResolution?.packageVersion !== "0.3.7") {
    fail("Expected stale release progress to use the moved package.json version as proof");
  }
}

function smokeLoopFileCreation() {
  const projectDir = resolve(tempRoot, "loop-file");
  mkdirSync(projectDir, { recursive: true });
  const created = run(nodeBin, [
    cliPath,
    "new",
    "--name",
    "Docs sweep",
    "--objective",
    "Find stale setup docs",
    "--check",
    "npm test -- docs",
    "--max-iterations",
    "3",
  ], { cwd: projectDir });
  for (const text of ["Created .loop-it/LOOP.md", "Created .loop-it/progress.json"]) {
    if (!created.stdout.includes(text)) {
      fail(`Expected loop creation output to include ${JSON.stringify(text)}`);
    }
  }

  const loopFile = resolve(projectDir, ".loop-it", "LOOP.md");
  const progressFile = resolve(projectDir, ".loop-it", "progress.json");
  assertFile(loopFile);
  assertFile(progressFile);
  const content = readFileSync(loopFile, "utf8");
  for (const text of ["# Docs sweep", "Find stale setup docs", "npm test -- docs", "Max iterations: 3"]) {
    if (!content.includes(text)) {
      fail(`Expected ${loopFile} to contain ${JSON.stringify(text)}`);
    }
  }
  const progress = JSON.parse(readFileSync(progressFile, "utf8"));
  if (progress.loopName !== "Docs sweep" || progress.lastCheck !== "npm test -- docs") {
    fail("Expected progress.json to track the generated loop");
  }

  const libraryProjectDir = resolve(tempRoot, "library-loop-file");
  mkdirSync(libraryProjectDir, { recursive: true });
  run(nodeBin, [cliPath, "new", "--from", "failing-ci-repair"], { cwd: libraryProjectDir });
  const libraryLoopFile = resolve(libraryProjectDir, ".loop-it", "LOOP.md");
  const libraryProgressFile = resolve(libraryProjectDir, ".loop-it", "progress.json");
  assertFile(libraryLoopFile);
  assertFile(libraryProgressFile);
  const libraryContent = readFileSync(libraryLoopFile, "utf8");
  for (const text of ["# Failing CI repair", "Loop id: failing-ci-repair", "Fix the failing check"]) {
    if (!libraryContent.includes(text)) {
      fail(`Expected ${libraryLoopFile} to contain ${JSON.stringify(text)}`);
    }
  }
  const libraryProgress = JSON.parse(readFileSync(libraryProgressFile, "utf8"));
  if (libraryProgress.activeLoopId !== "failing-ci-repair") {
    fail("Expected library progress to track the loop id");
  }

  const duplicate = spawnSync(nodeBin, [cliPath, "new", "--name", "Duplicate", "--objective", "x", "--check", "y"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  if (duplicate.status === 0) {
    fail("Expected duplicate loop file creation without --force to fail");
  }
}

function smokeLoopWriting() {
  const projectDir = resolve(tempRoot, "loop-write");
  mkdirSync(projectDir, { recursive: true });
  const written = run(nodeBin, [
    cliPath,
    "write",
    "--goal",
    "Fix failing checkout tests",
    "--check",
    "npm test -- checkout",
    "--max-iterations",
    "4",
  ], { cwd: projectDir });

  for (const text of ["Created .loop-it/LOOP.md", "Created .loop-it/progress.json"]) {
    if (!written.stdout.includes(text)) {
      fail(`Expected loop write output to include ${JSON.stringify(text)}`);
    }
  }

  const loopFile = resolve(projectDir, ".loop-it", "LOOP.md");
  const progressFile = resolve(projectDir, ".loop-it", "progress.json");
  assertFile(loopFile);
  assertFile(progressFile);

  const content = readFileSync(loopFile, "utf8");
  for (const text of ["Fix failing checkout tests", "npm test -- checkout", "Max iterations: 4"]) {
    if (!content.includes(text)) {
      fail(`Expected ${loopFile} to contain ${JSON.stringify(text)}`);
    }
  }

  const progress = JSON.parse(readFileSync(progressFile, "utf8"));
  if (progress.objective !== "Fix failing checkout tests" || progress.lastCheck !== "npm test -- checkout") {
    fail("Expected progress.json to track the written loop goal and verifier");
  }

  const missingCheck = spawnSync(nodeBin, [cliPath, "write", "--goal", "Missing verifier"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  if (missingCheck.status === 0 || !missingCheck.stderr.includes("--check is required")) {
    fail("Expected loop write without --check to fail clearly");
  }
}

function smokeLoopStart() {
  const projectDir = resolve(tempRoot, "loop-start");
  mkdirSync(projectDir, { recursive: true });
  const started = run(nodeBin, [
    cliPath,
    "start",
    "--goal",
    "Fix failing checkout tests",
    "--check",
    "npm test -- checkout",
    "--agent",
    "all",
    "--max-iterations",
    "4",
  ], { cwd: projectDir });

  for (const text of [
    "Created .loop-it/LOOP.md",
    "Created .loop-it/progress.json",
    "Created .loop-it/LAUNCH.md",
    "## Codex Launch",
    "## Claude Code Launch",
    "## Cursor Launch",
    "Paste this as a normal message:",
    "Run this bounded Loop It task now in the current workspace.",
    "Goal: Fix failing checkout tests",
    "Proof requirement: Run the project verifier recorded in the local Loop It contract inside the agent workflow and report whether it passed.",
    "Iteration cap: 4",
    "the pasted launch prompt starts execution mode",
    "Do not ask me to run or copy terminal commands.",
  ]) {
    if (!started.stdout.includes(text)) {
      fail(`Expected loop start output to include ${JSON.stringify(text)}`);
    }
  }

  const loopFile = resolve(projectDir, ".loop-it", "LOOP.md");
  const launchFile = resolve(projectDir, ".loop-it", "LAUNCH.md");
  const progressFile = resolve(projectDir, ".loop-it", "progress.json");
  assertFile(loopFile);
  assertFile(launchFile);
  assertFile(progressFile);

  const launchContent = readFileSync(launchFile, "utf8");
  for (const text of [
    "Protocol\nDISCOVER -> PLAN -> EXECUTE -> VERIFY -> ITERATE",
    "If it refers to a project verifier recorded in a local Loop It contract, run that verifier inside the agent workflow and capture the actual result.",
    "Changes only to Loop It state files do not count as completing the task.",
    "Do not ask me to run or copy terminal commands.",
    "The prompt starts the task. The local Loop It files remain the portable contract and evidence record.",
  ]) {
    if (!launchContent.includes(text)) {
      fail(`Expected ${launchFile} to contain ${JSON.stringify(text)}`);
    }
  }
  if ((launchContent.match(/Paste this as a normal message:/g) ?? []).length !== 3) {
    fail("Expected Codex, Claude Code, and Cursor launches to use normal-message prompts");
  }
  assertUserFacingPromptOnly(launchContent, "generated multi-agent launch prompts");

  const progress = JSON.parse(readFileSync(progressFile, "utf8"));
  if (progress.status !== "ready" || progress.verifier !== "npm test -- checkout" || progress.maxIterations !== 4) {
    fail("Expected progress.json to track the started loop launcher contract");
  }

  const missingCheck = spawnSync(nodeBin, [cliPath, "start", "--goal", "Missing verifier"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  if (missingCheck.status === 0 || !missingCheck.stderr.includes("--check is required")) {
    fail("Expected loop start without --check to fail clearly");
  }
}

function smokeLoopRun() {
  const projectDir = resolve(tempRoot, "loop-run-intake");
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(
    resolve(projectDir, "package.json"),
    JSON.stringify(
      {
        name: "loop-run-intake-fixture",
        scripts: {
          check: "node -e \"process.exit(0)\"",
          test: "node -e \"process.exit(0)\"",
        },
      },
      null,
      2
    )
  );

  const intake = run(nodeBin, [
    cliPath,
    "run",
    "--goal",
    "inspect this repo and run the right loop",
    "--agent",
    "codex",
  ], { cwd: projectDir });

  for (const text of [
    "Recommended loop: Codebase intake to running loop (codebase-intake-to-running-loop)",
    "Verifier: npm run check",
    "Preparing run-mode launch prompt",
    "Created .loop-it/LOOP.md",
    "Created .loop-it/progress.json",
    "Created .loop-it/LAUNCH.md",
  ]) {
    if (!intake.stdout.includes(text)) {
      fail(`Expected loop run output to include ${JSON.stringify(text)}`);
    }
  }

  const progressFile = resolve(projectDir, ".loop-it", "progress.json");
  const launchFile = resolve(projectDir, ".loop-it", "LAUNCH.md");
  assertFile(progressFile);
  assertFile(launchFile);

  const progress = JSON.parse(readFileSync(progressFile, "utf8"));
  if (progress.activeLoopId !== "codebase-intake-to-running-loop" || progress.verifier !== "npm run check") {
    fail("Expected intake run progress to track the selected loop and inferred check");
  }

  const launchContent = readFileSync(launchFile, "utf8");
  for (const text of [
    "Paste this as a normal message:",
    "Run this bounded Loop It task now in the current workspace.",
    "Goal\ninspect this repo and run the right loop",
    "Proof required\nRun the project verifier recorded in the local Loop It contract inside the agent workflow and report whether it passed.",
    "Changes only to Loop It state files do not count as completing the task.",
    "Do not ask me to run or copy terminal commands.",
  ]) {
    if (!launchContent.includes(text)) {
      fail(`Expected run launch prompt to contain ${JSON.stringify(text)}`);
    }
  }
  assertUserFacingPromptOnly(launchContent, "intake run launch prompt");

  const failingProjectDir = resolve(tempRoot, "loop-run-failing-test");
  mkdirSync(failingProjectDir, { recursive: true });
  writeFileSync(
    resolve(failingProjectDir, "package.json"),
    JSON.stringify(
      {
        name: "loop-run-failing-test-fixture",
        scripts: {
          test: "node test.mjs",
        },
      },
      null,
      2
    )
  );
  writeFileSync(
    resolve(failingProjectDir, "test.mjs"),
    [
      "import assert from 'node:assert/strict';",
      "",
      "assert.equal(1 + 1, 3);",
      "",
    ].join("\n")
  );
  const failing = run(nodeBin, [
    cliPath,
    "run",
    "--goal",
    "fix failing npm test with the smallest safe change",
    "--check",
    "npm test",
    "--agent",
    "codex",
  ], { cwd: failingProjectDir });

  for (const text of [
    "Recommended loop: Failing CI repair (failing-ci-repair)",
    "Verifier: npm test",
    "Preparing run-mode launch prompt",
    "Created .loop-it/LOOP.md",
    "Created .loop-it/progress.json",
    "Created .loop-it/LAUNCH.md",
  ]) {
    if (!failing.stdout.includes(text)) {
      fail(`Expected failing test run output to include ${JSON.stringify(text)}`);
    }
  }

  const failingLoopFile = resolve(failingProjectDir, ".loop-it", "LOOP.md");
  const failingProgressFile = resolve(failingProjectDir, ".loop-it", "progress.json");
  const failingLaunchFile = resolve(failingProjectDir, ".loop-it", "LAUNCH.md");
  assertFile(failingLoopFile);
  assertFile(failingProgressFile);
  assertFile(failingLaunchFile);

  const failingProgress = JSON.parse(readFileSync(failingProgressFile, "utf8"));
  if (
    failingProgress.activeLoopId !== "failing-ci-repair" ||
    failingProgress.status !== "ready" ||
    failingProgress.verifier !== "npm test" ||
    failingProgress.lastResult !== "not-run" ||
    failingProgress.recommendedNextAction !==
      "Open the generated prompt in the selected agent; changes only to Loop It state files do not count as progress."
  ) {
    fail("Expected failing test run progress to prepare execution without claiming completion");
  }

  const failingLoopContent = readFileSync(failingLoopFile, "utf8");
  for (const text of [
    "# Failing CI repair",
    "Command or criterion: npm test",
    "This file is the contract; it does not repair code until an agent runs the launch prompt.",
  ]) {
    if (!failingLoopContent.includes(text)) {
      fail(`Expected failing test loop contract to contain ${JSON.stringify(text)}`);
    }
  }

  const failingLaunchContent = readFileSync(failingLaunchFile, "utf8");
  for (const text of [
    "Paste this as a normal message:",
    "Run this bounded Loop It task now in the current workspace.",
    "Goal\nfix failing project checks with the smallest safe change",
    "Proof required\nRun the project verifier recorded in the local Loop It contract inside the agent workflow and report whether it passed.",
    "If it refers to a project verifier recorded in a local Loop It contract, run that verifier inside the agent workflow and capture the actual result.",
    "Changes only to Loop It state files do not count as completing the task.",
    "Record evidence, changed files or artifacts, blockers, remaining risks, and the next safe action.",
  ]) {
    if (!failingLaunchContent.includes(text)) {
      fail(`Expected failing test launch prompt to contain ${JSON.stringify(text)}`);
    }
  }
  assertUserFacingPromptOnly(failingLaunchContent, "failing test launch prompt");

  const plan = JSON.parse(
    run(nodeBin, [
      cliPath,
      "run",
      "--goal",
      "inspect this repo and run the right loop",
      "--cwd",
      projectDir,
      "--json",
    ]).stdout
  );
  if (plan.selectedLoopId !== "codebase-intake-to-running-loop" || plan.check !== "npm run check") {
    fail("Expected run --json to report the selected intake loop and inferred check");
  }
}

function smokeLoopExecute() {
  const projectDir = resolve(tempRoot, "loop-run-execute");
  const fakeCodex = resolve(tempRoot, "fake-codex.mjs");
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(
    resolve(projectDir, "package.json"),
    JSON.stringify(
      {
        name: "loop-run-execute-fixture",
        type: "module",
        scripts: {
          test: "node test.mjs",
        },
      },
      null,
      2
    )
  );
  writeFileSync(
    resolve(projectDir, "test.mjs"),
    [
      "import assert from 'node:assert/strict';",
      "",
      "function subtotal(items) {",
      "  return items.reduce((sum, item) => sum + item.price, 0);",
      "}",
      "",
      "const total = subtotal([{ price: 1 }, { price: 1 }]);",
      "assert.equal(total, 3);",
      "",
    ].join("\n")
  );
  const beforeExecution = spawnSync("npm", ["test"], {
    cwd: projectDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (beforeExecution.status === 0) {
    fail("Expected loop execution fixture to fail before fake Codex runs");
  }
  if (!`${beforeExecution.stdout}\n${beforeExecution.stderr}`.includes("3")) {
    fail("Expected pre-execution fixture failure output to include the wrong expected total");
  }
  writeFileSync(
    fakeCodex,
    [
      "#!/usr/bin/env node",
      "import { readFileSync, writeFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "",
      "const testPath = resolve(process.cwd(), 'test.mjs');",
      "const before = readFileSync(testPath, 'utf8');",
      "writeFileSync(testPath, before.replace('assert.equal(total, 3);', 'assert.equal(total, 2);'));",
      "",
      "const outputIndex = process.argv.indexOf('--output-last-message');",
      "if (outputIndex !== -1 && process.argv[outputIndex + 1]) {",
      "  writeFileSync(resolve(process.cwd(), process.argv[outputIndex + 1]), 'Fake Codex fixed failing test\\n');",
      "}",
      "",
    ].join("\n")
  );
  chmodSync(fakeCodex, 0o755);

  const executed = run(nodeBin, [
    cliPath,
    "run",
    "--from",
    "failing-ci-repair",
    "--goal",
    "Fix the failing npm test with the smallest safe change",
    "--check",
    "npm test",
    "--agent",
    "codex",
    "--execute",
    "codex",
    "--codex-bin",
    fakeCodex,
    "--codex-sandbox",
    "none",
    "--skip-git-repo-check",
  ], { cwd: projectDir });

  for (const text of [
    "Recommended loop: Failing CI repair (failing-ci-repair)",
    "Executing loop with Codex CLI:",
    "Running verifier after Codex iteration 1: npm test",
    "Verifier passed after Codex iteration 1: npm test",
    "Run proof:",
    "- Selected loop: Failing CI repair (failing-ci-repair)",
    "- Executor: Codex CLI",
    "- Verifier: npm test",
    "- Result: pass",
    "- Checker: skipped",
    "- Progress: .loop-it/progress.json",
    "- Codex output: .loop-it/CODEX_FINAL.md",
  ]) {
    if (!executed.stdout.includes(text)) {
      fail(`Expected executed loop output to include ${JSON.stringify(text)}`);
    }
  }

  const progressFile = resolve(projectDir, ".loop-it", "progress.json");
  const codexFinalFile = resolve(projectDir, ".loop-it", "CODEX_FINAL.md");
  assertFile(progressFile);
  assertFile(codexFinalFile);
  const testContent = readFileSync(resolve(projectDir, "test.mjs"), "utf8");
  if (!testContent.includes("assert.equal(total, 2);")) {
    fail("Expected fake Codex execution to update the failing test fixture");
  }
  const progress = JSON.parse(readFileSync(progressFile, "utf8"));
  if (
    progress.status !== "completed" ||
    progress.lastCheck !== "npm test" ||
    progress.lastResult !== "pass" ||
    progress.lastExecutor !== "codex" ||
    progress.lastCodexOutput !== ".loop-it/CODEX_FINAL.md" ||
    progress.lastChecker !== "skipped" ||
    progress.lastCheckerOutput !== null ||
    progress.recommendedNextAction !==
      "Stop; verifier passed after Codex execution. Add --checker codex when independent review proof is required."
  ) {
    fail("Expected executed loop progress to record verifier success");
  }
  if (
    progress.proof?.selectedLoopId !== "failing-ci-repair" ||
    progress.proof?.executor !== "codex" ||
    progress.proof?.verifier !== "npm test" ||
    progress.proof?.result !== "pass" ||
    progress.proof?.codexOutput !== ".loop-it/CODEX_FINAL.md" ||
    progress.proof?.checker?.result !== "skipped" ||
    !Array.isArray(progress.proof?.changedFiles)
  ) {
    fail("Expected executed loop progress to include machine-readable run proof");
  }
}

function smokeScheduledRunner() {
  const projectDir = resolve(tempRoot, "loop-schedule-execute");
  const codexHome = resolve(tempRoot, "codex-home");
  const fakeCodex = resolve(tempRoot, "fake-codex-schedule.mjs");
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(
    resolve(projectDir, "package.json"),
    JSON.stringify(
      {
        name: "loop-schedule-execute-fixture",
        type: "module",
        scripts: {
          test: "node test.mjs",
        },
      },
      null,
      2
    )
  );
  writeFileSync(
    resolve(projectDir, "test.mjs"),
    [
      "import assert from 'node:assert/strict';",
      "",
      "const total = 1 + 1;",
      "assert.equal(total, 3);",
      "",
    ].join("\n")
  );
  writeFileSync(
    fakeCodex,
    [
      "#!/usr/bin/env node",
      "import { readFileSync, writeFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "",
      "const testPath = resolve(process.cwd(), 'test.mjs');",
      "const before = readFileSync(testPath, 'utf8');",
      "writeFileSync(testPath, before.replace('assert.equal(total, 3);', 'assert.equal(total, 2);'));",
      "",
      "const outputIndex = process.argv.indexOf('--output-last-message');",
      "if (outputIndex !== -1 && process.argv[outputIndex + 1]) {",
      "  writeFileSync(resolve(process.cwd(), process.argv[outputIndex + 1]), 'Fake Codex fixed scheduled failing check\\n');",
      "}",
      "",
    ].join("\n")
  );
  chmodSync(fakeCodex, 0o755);

  const notSchedulable = spawnSync(nodeBin, [
    cliPath,
    "schedule",
    "--from",
    "failing-ci-repair",
    "--every",
    "5m",
    "--check",
    "npm test",
    "--execute",
    "codex",
  ], {
    cwd: projectDir,
    encoding: "utf8",
  });
  if (notSchedulable.status === 0 || !notSchedulable.stderr.includes("Scheduled execution is only for time-based or proactive loops")) {
    fail("Expected schedule to reject goal-based loops");
  }

  const now = "2026-07-07T10:00:00.000Z";
  const scheduled = run(nodeBin, [
    cliPath,
    "schedule",
    "--from",
    "ci-health-watch",
    "--id",
    "ci-watch",
    "--every",
    "5m",
    "--goal",
    "Check CI and fix the failing npm test when it breaks",
    "--check",
    "npm test",
    "--execute",
    "codex",
    "--heartbeat",
    "codex",
    "--heartbeat-id",
    "ci-watch-heartbeat",
    "--heartbeat-name",
    "Loop It smoke heartbeat",
    "--codex-home",
    codexHome,
    "--no-worktree",
    "--now",
    now,
  ], { cwd: projectDir });
  for (const text of [
    "Created schedule: ci-watch",
    "Loop: CI health watch (ci-health-watch)",
    "Execute: codex",
    "Heartbeat: Codex Scheduled task Loop It smoke heartbeat (ci-watch-heartbeat)",
  ]) {
    if (!scheduled.stdout.includes(text)) {
      fail(`Expected schedule output to include ${JSON.stringify(text)}`);
    }
  }

  const schedulePath = resolve(projectDir, ".loop-it", "schedules", "ci-watch.json");
  const automationPath = resolve(codexHome, "automations", "ci-watch-heartbeat", "automation.toml");
  assertFile(schedulePath);
  assertFile(automationPath);
  const schedule = JSON.parse(readFileSync(schedulePath, "utf8"));
  if (
    schedule.loopId !== "ci-health-watch" ||
    schedule.loopType !== "time-based" ||
    schedule.execute !== "codex" ||
    schedule.worktree !== false ||
    schedule.nextRunAt !== now ||
    schedule.heartbeat?.id !== "ci-watch-heartbeat" ||
    schedule.heartbeat?.type !== "codex"
  ) {
    fail("Expected schedule record to track the Codex-only time-based loop and heartbeat");
  }
  const automationToml = readFileSync(automationPath, "utf8");
  for (const text of [
    'id = "ci-watch-heartbeat"',
    'name = "Loop It smoke heartbeat"',
    'status = "ACTIVE"',
    'rrule = "FREQ=MINUTELY;INTERVAL=5"',
    "npx @fhajjej/loop-it@latest tick --all --execute codex",
    projectDir,
  ]) {
    if (!automationToml.includes(text)) {
      fail(`Expected Codex automation TOML to include ${JSON.stringify(text)}`);
    }
  }

  const ticked = run(nodeBin, [
    cliPath,
    "tick",
    "--all",
    "--execute",
    "codex",
    "--now",
    now,
    "--codex-bin",
    fakeCodex,
    "--codex-sandbox",
    "none",
    "--skip-git-repo-check",
  ], { cwd: projectDir });
  for (const text of [
    "Ticking schedule: ci-watch",
    "Scheduled check failed before Codex execution: npm test",
    "Recommended loop: CI health watch (ci-health-watch)",
    "Verifier passed after Codex iteration 1: npm test",
    "Scheduled Codex run result: pass",
  ]) {
    if (!ticked.stdout.includes(text)) {
      fail(`Expected tick output to include ${JSON.stringify(text)}`);
    }
  }

  const updatedSchedule = JSON.parse(readFileSync(schedulePath, "utf8"));
  if (
    updatedSchedule.runCount !== 1 ||
    updatedSchedule.lastResult !== "pass" ||
    updatedSchedule.lastRunAt !== now ||
    updatedSchedule.nextRunAt !== "2026-07-07T10:05:00.000Z"
  ) {
    fail("Expected tick to update schedule run state and next run time");
  }
  const testContent = readFileSync(resolve(projectDir, "test.mjs"), "utf8");
  if (!testContent.includes("assert.equal(total, 2);")) {
    fail("Expected scheduled fake Codex execution to update the failing test fixture");
  }
  const progress = JSON.parse(readFileSync(resolve(projectDir, ".loop-it", "progress.json"), "utf8"));
  if (
    progress.scheduleId !== "ci-watch" ||
    progress.scheduledLoopId !== "ci-health-watch" ||
    progress.lastResult !== "pass" ||
    progress.proof?.selectedLoopId !== "ci-health-watch" ||
    progress.proof?.schedule?.scheduleId !== "ci-watch" ||
    progress.proof?.schedule?.precheckStatus !== 1
  ) {
    fail("Expected scheduled tick to annotate progress proof");
  }

  const locked = run(nodeBin, [
    cliPath,
    "schedule",
    "--from",
    "ci-health-watch",
    "--id",
    "locked-ci-watch",
    "--every",
    "5m",
    "--check",
    "npm test",
    "--execute",
    "codex",
    "--no-worktree",
    "--now",
    now,
  ], { cwd: projectDir });
  if (!locked.stdout.includes("Created schedule: locked-ci-watch")) {
    fail("Expected locked schedule fixture to be created");
  }
  writeFileSync(resolve(projectDir, ".loop-it", "schedules", "locked-ci-watch.lock"), "locked\n");
  const lockedTick = run(nodeBin, [
    cliPath,
    "tick",
    "--id",
    "locked-ci-watch",
    "--execute",
    "codex",
    "--now",
    now,
  ], { cwd: projectDir });
  if (!lockedTick.stdout.includes("Skipping locked schedule: locked-ci-watch")) {
    fail("Expected locked schedule to be skipped");
  }

  const listed = JSON.parse(run(nodeBin, [cliPath, "schedules", "list", "--cwd", projectDir, "--json"]).stdout);
  const listedSchedule = listed.schedules.find((item) => item.id === "ci-watch");
  if (
    !listedSchedule ||
    listedSchedule.heartbeat?.type !== "codex" ||
    listedSchedule.heartbeat?.exists !== true ||
    listedSchedule.heartbeat?.status !== "ACTIVE"
  ) {
    fail("Expected schedules list to report Codex heartbeat status");
  }

  run(nodeBin, [cliPath, "schedules", "pause", "--cwd", projectDir, "--id", "ci-watch"]);
  const paused = JSON.parse(readFileSync(schedulePath, "utf8"));
  if (paused.status !== "paused") {
    fail("Expected schedules pause to update the schedule status");
  }
  run(nodeBin, [cliPath, "schedules", "resume", "--cwd", projectDir, "--id", "ci-watch"]);
  const resumed = JSON.parse(readFileSync(schedulePath, "utf8"));
  if (resumed.status !== "active") {
    fail("Expected schedules resume to update the schedule status");
  }
}

function smokeDoctor() {
  const projectDir = resolve(tempRoot, "doctor");
  const codexHome = resolve(tempRoot, "doctor-codex-home");
  const desktopHome = resolve(tempRoot, "doctor-desktop-home");
  const desktopCodex = resolve(desktopHome, "Applications", "ChatGPT.app", "Contents", "Resources", "codex");
  const fakeCodex = resolve(tempRoot, "fake-codex-doctor.mjs");
  const fakeNpm = resolve(tempRoot, "fake-npm-doctor.mjs");
  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  mkdirSync(projectDir, { recursive: true });

  writeFileSync(
    fakeCodex,
    [
      "#!/usr/bin/env node",
      "console.log('codex-cli 1.2.3');",
      "",
    ].join("\n")
  );
  chmodSync(fakeCodex, 0o755);

  writeFileSync(
    fakeNpm,
    [
      "#!/usr/bin/env node",
      `console.log(${JSON.stringify(packageJson.version)});`,
      "",
    ].join("\n")
  );
  chmodSync(fakeNpm, 0o755);

  mkdirSync(dirname(desktopCodex), { recursive: true });
  writeFileSync(desktopCodex, "#!/usr/bin/env node\nconsole.log('codex-cli desktop-1.2.3');\n");
  chmodSync(desktopCodex, 0o755);

  const pluginPath = resolve(
    codexHome,
    "plugins",
    "cache",
    "personal",
    "loop-it",
    packageJson.version,
    ".codex-plugin",
    "plugin.json"
  );
  mkdirSync(dirname(pluginPath), { recursive: true });
  writeFileSync(pluginPath, JSON.stringify({ name: "loop-it", version: packageJson.version }, null, 2) + "\n");

  const now = "2026-07-07T12:00:00.000Z";
  run(nodeBin, [
    cliPath,
    "schedule",
    "--from",
    "ci-health-watch",
    "--id",
    "doctor-ci-watch",
    "--every",
    "5m",
    "--check",
    "npm test",
    "--execute",
    "codex",
    "--heartbeat",
    "codex",
    "--heartbeat-id",
    "doctor-heartbeat",
    "--codex-home",
    codexHome,
    "--no-worktree",
    "--now",
    now,
  ], { cwd: projectDir });

  const ready = JSON.parse(run(nodeBin, [
    cliPath,
    "doctor",
    "--cwd",
    projectDir,
    "--codex-home",
    codexHome,
    "--codex-bin",
    fakeCodex,
    "--npm-bin",
    fakeNpm,
    "--json",
  ]).stdout);
  if (
    ready.ok !== true ||
    ready.status !== "ready" ||
    ready.package.version !== packageJson.version ||
    ready.codex.plugin.version !== packageJson.version ||
    ready.codex.cli.status !== "ready" ||
    ready.schedules.count !== 1 ||
    ready.schedules.records[0]?.heartbeat?.exists !== true
  ) {
    fail("Expected doctor to report a ready Loop It install with Codex heartbeat");
  }

  const desktopReady = JSON.parse(run(nodeBin, [
    cliPath,
    "doctor",
    "--cwd",
    projectDir,
    "--codex-home",
    codexHome,
    "--npm-bin",
    fakeNpm,
    "--json",
  ], {
    env: {
      HOME: desktopHome,
      PATH: [dirname(process.execPath), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(delimiter),
    },
  }).stdout);
  if (
    desktopReady.ok !== true ||
    desktopReady.codex.cli.status !== "ready" ||
    desktopReady.codex.cli.command !== desktopCodex
  ) {
    fail("Expected doctor to discover the bundled Codex Desktop CLI when codex is not on PATH");
  }

  const human = run(nodeBin, [
    cliPath,
    "doctor",
    "--cwd",
    projectDir,
    "--codex-home",
    codexHome,
    "--codex-bin",
    fakeCodex,
    "--npm-bin",
    fakeNpm,
  ]).stdout;
  for (const text of ["Loop It doctor", "Status: ready", "Schedules: 1", "Codex CLI: ready"]) {
    if (!human.includes(text)) {
      fail(`Expected doctor human output to include ${JSON.stringify(text)}`);
    }
  }

  const missingCodexHome = resolve(tempRoot, "doctor-missing-codex-home");
  const missingCodex = spawnSync(nodeBin, [
    cliPath,
    "doctor",
    "--cwd",
    projectDir,
    "--codex-home",
    missingCodexHome,
    "--codex-bin",
    resolve(tempRoot, "missing-codex-doctor"),
    "--npm-bin",
    fakeNpm,
    "--json",
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (missingCodex.status === 0) {
    fail("Expected doctor to fail when Codex CLI is missing");
  }
  const missingCodexReport = JSON.parse(missingCodex.stdout);
  if (
    missingCodexReport.ok !== false ||
    missingCodexReport.status !== "missing-codex-cli" ||
    !missingCodexReport.issues.some((issue) => issue.code === "missing-codex-plugin") ||
    !missingCodexReport.nextAction.includes("Install/authenticate Codex CLI")
  ) {
    fail("Expected doctor to prioritize the Codex CLI blocker over plugin warnings");
  }

  writeFileSync(pluginPath, "{\n");
  const invalidPlugin = JSON.parse(run(nodeBin, [
    cliPath,
    "doctor",
    "--cwd",
    projectDir,
    "--codex-home",
    codexHome,
    "--codex-bin",
    fakeCodex,
    "--npm-bin",
    fakeNpm,
    "--json",
  ]).stdout);
  if (
    invalidPlugin.ok !== true ||
    invalidPlugin.status !== "invalid-codex-plugin" ||
    invalidPlugin.codex.plugin.status !== "invalid" ||
    !invalidPlugin.issues.some((issue) => issue.code === "invalid-codex-plugin")
  ) {
    fail("Expected doctor to report malformed Codex plugin metadata without crashing");
  }
  writeFileSync(pluginPath, JSON.stringify({ name: "loop-it", version: packageJson.version }, null, 2) + "\n");

  const invalidSchedulePath = resolve(projectDir, ".loop-it", "schedules", "invalid-doctor-watch.json");
  writeFileSync(invalidSchedulePath, "{\n");
  const invalidSchedule = spawnSync(nodeBin, [
    cliPath,
    "doctor",
    "--cwd",
    projectDir,
    "--codex-home",
    codexHome,
    "--codex-bin",
    fakeCodex,
    "--npm-bin",
    fakeNpm,
    "--json",
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (invalidSchedule.status === 0) {
    fail("Expected doctor to fail when a schedule record contains malformed JSON");
  }
  const invalidScheduleReport = JSON.parse(invalidSchedule.stdout);
  if (
    invalidScheduleReport.ok !== false ||
    invalidScheduleReport.status !== "invalid-schedule" ||
    invalidScheduleReport.schedules.records.find((schedule) => schedule.path === invalidSchedulePath)?.status !== "invalid" ||
    !invalidScheduleReport.issues.some((issue) => issue.code === "invalid-schedule")
  ) {
    fail("Expected doctor to report malformed schedule metadata without crashing");
  }
  rmSync(invalidSchedulePath);

  const invalidPackageRoot = resolve(tempRoot, "doctor-invalid-package");
  const isolatedDoctorPath = resolve(invalidPackageRoot, "skills", "loop-it", "scripts", "doctor.mjs");
  mkdirSync(dirname(isolatedDoctorPath), { recursive: true });
  writeFileSync(isolatedDoctorPath, readFileSync(resolve(skillSource, "scripts", "doctor.mjs")));
  const isolatedCodexCliPath = resolve(dirname(isolatedDoctorPath), "lib", "codex-cli.mjs");
  mkdirSync(dirname(isolatedCodexCliPath), { recursive: true });
  writeFileSync(isolatedCodexCliPath, readFileSync(resolve(skillSource, "scripts", "lib", "codex-cli.mjs")));
  writeFileSync(resolve(invalidPackageRoot, "package.json"), "{\n");
  const invalidPackage = spawnSync(nodeBin, [
    isolatedDoctorPath,
    "--cwd",
    projectDir,
    "--codex-home",
    codexHome,
    "--codex-bin",
    fakeCodex,
    "--npm-bin",
    fakeNpm,
    "--json",
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (invalidPackage.status === 0) {
    fail("Expected doctor to fail when package metadata contains malformed JSON");
  }
  const invalidPackageReport = JSON.parse(invalidPackage.stdout);
  if (
    invalidPackageReport.ok !== false ||
    invalidPackageReport.status !== "invalid-package" ||
    invalidPackageReport.package.status !== "invalid" ||
    !invalidPackageReport.issues.some((issue) => issue.code === "invalid-package")
  ) {
    fail("Expected doctor to report malformed package metadata without crashing");
  }

  const heartbeatPath = ready.schedules.records[0]?.heartbeat?.path;
  if (!heartbeatPath) {
    fail("Expected ready report to include a Codex heartbeat path");
  }
  assertFile(heartbeatPath);
  rmSync(heartbeatPath);
  const missing = spawnSync(nodeBin, [
    cliPath,
    "doctor",
    "--cwd",
    projectDir,
    "--codex-home",
    codexHome,
    "--codex-bin",
    fakeCodex,
    "--npm-bin",
    fakeNpm,
    "--json",
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (missing.status === 0) {
    fail("Expected doctor to fail when a configured Codex heartbeat file is missing");
  }
  const missingReport = JSON.parse(missing.stdout);
  if (
    missingReport.ok !== false ||
    missingReport.status !== "missing-heartbeat" ||
    !missingReport.issues.some((issue) => issue.code === "missing-heartbeat")
  ) {
    fail("Expected doctor to report missing-heartbeat when the automation file is gone");
  }
}

function smokeGitHubConnector() {
  const projectDir = resolve(tempRoot, "github-connector");
  const codexHome = resolve(tempRoot, "github-codex-home");
  const fakeGh = resolve(tempRoot, "fake-gh.mjs");
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(
    fakeGh,
    [
      "#!/usr/bin/env node",
      "const args = process.argv.slice(2);",
      "if (args[0] === 'pr' && args[1] === 'view' && args.includes('--jq')) {",
      "  console.log('CHANGES_REQUESTED');",
      "  process.exit(0);",
      "}",
      "if (args[0] === 'pr' && args[1] === 'view') {",
      "  console.log(JSON.stringify({",
      "    number: 42,",
      "    title: 'Fix checkout flow',",
      "    state: 'OPEN',",
      "    url: 'https://github.com/acme/app/pull/42',",
      "    baseRefName: 'main',",
      "    headRefName: 'fix-checkout',",
      "    mergeStateStatus: 'CLEAN',",
      "    reviewDecision: 'CHANGES_REQUESTED',",
      "    statusCheckRollup: [],",
      "    reviews: [{ state: 'CHANGES_REQUESTED', author: { login: 'reviewer' } }]",
      "  }));",
      "  process.exit(0);",
      "}",
      "if (args[0] === 'pr' && args[1] === 'checks') {",
      "  process.exit(0);",
      "}",
      "console.error('unexpected gh args: ' + args.join(' '));",
      "process.exit(2);",
      "",
    ].join("\n")
  );
  chmodSync(fakeGh, 0o755);

  const now = "2026-07-07T11:00:00.000Z";
  const connected = run(nodeBin, [
    cliPath,
    "github",
    "pr",
    "--repo",
    "acme/app",
    "--pr",
    "42",
    "--every",
    "15m",
    "--execute",
    "codex",
    "--heartbeat",
    "codex",
    "--heartbeat-id",
    "github-pr-heartbeat",
    "--heartbeat-name",
    "Loop It PR smoke",
    "--codex-home",
    codexHome,
    "--gh-bin",
    fakeGh,
    "--no-worktree",
    "--now",
    now,
  ], { cwd: projectDir });

  for (const text of [
    "GitHub PR connector: acme/app#42",
    "Selected loop: Review comment resolver routine (review-comment-resolver-routine)",
    "Reason: PR review decision is CHANGES_REQUESTED",
    "Connector snapshot: .loop-it/connectors/github/github-pr-acme-app-42.json",
    "Created schedule: github-pr-acme-app-42",
    "Heartbeat: Codex Scheduled task Loop It PR smoke (github-pr-heartbeat)",
  ]) {
    if (!connected.stdout.includes(text)) {
      fail(`Expected GitHub connector output to include ${JSON.stringify(text)}`);
    }
  }

  const connectorPath = resolve(projectDir, ".loop-it", "connectors", "github", "github-pr-acme-app-42.json");
  const schedulePath = resolve(projectDir, ".loop-it", "schedules", "github-pr-acme-app-42.json");
  const automationPath = resolve(codexHome, "automations", "github-pr-heartbeat", "automation.toml");
  assertFile(connectorPath);
  assertFile(schedulePath);
  assertFile(automationPath);

  const connector = JSON.parse(readFileSync(connectorPath, "utf8"));
  const schedule = JSON.parse(readFileSync(schedulePath, "utf8"));
  if (
    connector.selectedLoopId !== "review-comment-resolver-routine" ||
    connector.snapshot?.reviewDecision !== "CHANGES_REQUESTED" ||
    schedule.connector !== "github" ||
    schedule.loopId !== "review-comment-resolver-routine" ||
    schedule.target !== "github:acme/app#42" ||
    schedule.checker !== "codex" ||
    !schedule.check.includes("reviewDecision")
  ) {
    fail("Expected GitHub connector to create a review-driven scheduled loop");
  }

  const listed = JSON.parse(run(nodeBin, [cliPath, "schedules", "list", "--cwd", projectDir, "--json"]).stdout);
  const githubSchedule = listed.schedules.find((item) => item.id === "github-pr-acme-app-42");
  if (
    !githubSchedule ||
    githubSchedule.connector !== "github" ||
    githubSchedule.heartbeat?.exists !== true ||
    githubSchedule.heartbeat?.status !== "ACTIVE"
  ) {
    fail("Expected GitHub schedule to appear in schedule list with heartbeat status");
  }
}

function smokePackedCli() {
  const packDir = resolve(tempRoot, "pack");
  const projectDir = resolve(tempRoot, "packed-project");
  mkdirSync(packDir, { recursive: true });
  mkdirSync(projectDir, { recursive: true });
  const pack = run("npm", ["pack", "--json", "--pack-destination", packDir, "--dry-run=false"], { cwd: repoRoot });
  const packageInfo = JSON.parse(pack.stdout);
  const tarballPath = resolve(packDir, packageInfo[0]?.filename ?? "");
  assertFile(tarballPath);

  run("npm", [
    "exec",
    "--yes",
    "--package",
    tarballPath,
    "--",
    "loop-it",
    "install",
    "--agent",
    "all",
    "--scope",
    "project",
    "--cwd",
    projectDir,
  ]);

  run("npm", [
    "exec",
    "--yes",
    "--package",
    tarballPath,
    "--",
    "loop-it",
    "start",
    "--goal",
    "Verify packed launcher",
    "--check",
    "npm test",
    "--agent",
    "codex",
    "--force",
  ], { cwd: projectDir });

  for (const target of [
    ".agents/skills/loop-it/SKILL.md",
    ".claude/skills/loop-it/SKILL.md",
    ".cursor/skills/loop-it/SKILL.md",
    ".agents/skills/loop-it/references/library/loops.json",
    ".agents/skills/loop-it/references/library/goals.json",
    ".agents/skills/loop-it/references/library/goals-schema.json",
    ".agents/skills/loop-it/references/library/goals-evals.json",
    ".agents/skills/loop-it/scripts/select-loop.mjs",
    ".agents/skills/loop-it/scripts/goal-library.mjs",
    ".agents/skills/loop-it/scripts/start-loop.mjs",
    ".agents/skills/loop-it/scripts/run-loop.mjs",
    ".agents/skills/loop-it/scripts/schedule-loop.mjs",
    ".agents/skills/loop-it/scripts/github-connector.mjs",
    ".agents/skills/loop-it/scripts/doctor.mjs",
    ".loop-it/LOOP.md",
    ".loop-it/LAUNCH.md",
  ]) {
    assertFile(resolve(projectDir, target));
  }

  for (const target of [
    ".agents/skills/loop-it",
    ".claude/skills/loop-it",
    ".cursor/skills/loop-it",
  ]) {
    assertDirectoryMatches(skillSource, resolve(projectDir, target));
  }
}

function run(command, args, options = {}) {
  const env = { ...process.env };
  Object.assign(env, options.env ?? {});
  delete env.npm_config_dry_run;
  delete env.NPM_CONFIG_DRY_RUN;

  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    fail(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return result;
}

function assertFile(path) {
  if (!existsSync(path)) {
    fail(`Expected file to exist: ${path}`);
  }
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    fail(`Expected ${label} to include ${JSON.stringify(expected)}`);
  }
}

function assertUserFacingPromptOnly(content, label) {
  for (const [name, pattern] of forbiddenUserPromptPatterns) {
    if (pattern.test(content)) {
      fail(`Expected ${label} not to contain user-facing ${name} terminal syntax`);
    }
  }
}

function assertRecommendedLoop(goal, expectedLoopId) {
  const recommendation = JSON.parse(run(nodeBin, [cliPath, "recommend", "--goal", goal, "--json"]).stdout);
  if (recommendation.selected?.loop?.id !== expectedLoopId) {
    fail(`Expected ${JSON.stringify(goal)} to recommend ${expectedLoopId}, got ${recommendation.selected?.loop?.id}`);
  }
  if (!recommendation.decision?.confidence || recommendation.decision.confidence === "low") {
    fail(`Expected ${JSON.stringify(goal)} to have non-low recommendation confidence`);
  }
}

function assertReliabilityMetadata(loop) {
  const metadata = loop.reliability;
  if (!metadata || typeof metadata !== "object") {
    fail(`Expected ${loop.id} to include reliability metadata`);
  }

  if (!["experimental", "tested", "proven"].includes(metadata.status)) {
    fail(`Expected ${loop.id} reliability.status to be experimental, tested, or proven`);
  }

  for (const field of ["summary", "requiredCheck"]) {
    if (typeof metadata[field] !== "string" || metadata[field].trim().length === 0) {
      fail(`Expected ${loop.id} reliability.${field} to be a non-empty string`);
    }
  }

  for (const field of ["bestWhen", "failsWhen"]) {
    if (!Array.isArray(metadata[field]) || metadata[field].length === 0) {
      fail(`Expected ${loop.id} reliability.${field} to be a non-empty array`);
    }
    for (const item of metadata[field]) {
      if (typeof item !== "string" || item.trim().length === 0) {
        fail(`Expected ${loop.id} reliability.${field} entries to be non-empty strings`);
      }
    }
  }

  if (metadata.status === "proven") {
    fail(`Expected ${loop.id} not to claim proven reliability without multi-repo eval evidence`);
  }
}

function assertUserGuideMetadata(loop) {
  const guide = loop.userGuide;
  if (!guide || typeof guide !== "object") {
    fail(`Expected ${loop.id} to include userGuide metadata`);
  }

  for (const field of ["plainLanguage", "useWhen", "starterRequest", "firstStep", "proofTip", "notFor"]) {
    if (typeof guide[field] !== "string" || guide[field].trim().length === 0) {
      fail(`Expected ${loop.id} userGuide.${field} to be a non-empty string`);
    }
  }
}

function assertDirectoryMatches(sourceDir, targetDir) {
  const sourceFiles = relativeFileList(sourceDir);
  const targetFiles = relativeFileList(targetDir);
  if (JSON.stringify(sourceFiles) !== JSON.stringify(targetFiles)) {
    fail(`Expected ${targetDir} to contain the same files as ${sourceDir}`);
  }

  for (const file of sourceFiles) {
    const sourceBytes = readFileSync(resolve(sourceDir, file));
    const targetBytes = readFileSync(resolve(targetDir, file));
    if (Buffer.compare(sourceBytes, targetBytes) !== 0) {
      fail(`Expected ${resolve(targetDir, file)} to match ${resolve(sourceDir, file)}`);
    }
  }
}

function relativeFileList(rootDir) {
  const files = [];
  collectFiles(rootDir, "", files);
  return files.sort();
}

function collectFiles(rootDir, relativeDir, files) {
  const currentDir = resolve(rootDir, relativeDir);
  for (const entry of readdirSync(currentDir).sort()) {
    const relativePath = relativeDir ? `${relativeDir}/${entry}` : entry;
    const fullPath = resolve(rootDir, relativePath);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectFiles(rootDir, relativePath, files);
    } else if (stat.isFile()) {
      files.push(relativePath);
    }
  }
}

function writeProgress(projectDir, progress) {
  const loopDir = resolve(projectDir, ".loop-it");
  mkdirSync(loopDir, { recursive: true });
  writeFileSync(resolve(loopDir, "progress.json"), JSON.stringify(progress, null, 2));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
