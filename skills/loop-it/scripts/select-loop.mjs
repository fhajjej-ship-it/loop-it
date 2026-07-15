#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  assertPromptText,
  compileGoalPrompt,
  recommendGoalTemplate,
  sanitizePromptObjective,
} from "./goal-library.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");
const libraryPath = resolve(skillRoot, "references", "library", "loops.json");
const evalsPath = resolve(skillRoot, "references", "library", "evals.json");
const stopWords = new Set([
  "and",
  "are",
  "but",
  "can",
  "for",
  "from",
  "has",
  "have",
  "into",
  "our",
  "that",
  "the",
  "this",
  "to",
  "want",
  "what",
  "when",
  "with",
]);

export function loadLibrary() {
  const library = JSON.parse(readFileSync(libraryPath, "utf8"));
  if (!Array.isArray(library.loops)) {
    throw new Error("Loop library is missing a loops array.");
  }
  return library;
}

export function loadEvals() {
  const evals = JSON.parse(readFileSync(evalsPath, "utf8"));
  if (!Array.isArray(evals.scenarios)) {
    throw new Error("Loop library evals are missing a scenarios array.");
  }
  return evals;
}

export function findLoopById(id, library = loadLibrary()) {
  const normalized = normalizeId(id);
  return library.loops.find((loop) => normalizeId(loop.id) === normalized) ?? null;
}

export function rankLoops(query, options = {}) {
  const library = options.library ?? loadLibrary();
  const limit = Number.isInteger(options.limit) ? options.limit : library.loops.length;
  const tokens = tokenize(query);
  const ranked = library.loops
    .map((loop) => {
      const score = scoreLoop(loop, tokens, query, library);
      return {
        loop,
        score: score.total,
        reasons: score.reasons,
      };
    })
    .sort((a, b) => b.score - a.score || a.loop.title.localeCompare(b.loop.title));

  return ranked.map((item, index) => ({
    ...item,
    confidence: confidenceFor(item, ranked[index + 1] ?? null),
  })).slice(0, limit);
}

export function readProgress(cwd = process.cwd()) {
  const loopDir = resolve(cwd, ".loop-it");
  const progressPath = resolve(loopDir, "progress.json");
  const loopPath = resolve(loopDir, "LOOP.md");

  if (existsSync(progressPath)) {
    const data = JSON.parse(readFileSync(progressPath, "utf8"));
    return {
      source: progressPath,
      type: "json",
      data,
      text: progressText(data),
    };
  }

  if (existsSync(loopPath)) {
    const markdown = readFileSync(loopPath, "utf8");
    return {
      source: loopPath,
      type: "markdown",
      data: progressFromMarkdown(markdown),
      text: markdown,
    };
  }

  return null;
}

export function recommendLoop(options = {}) {
  const library = options.library ?? loadLibrary();
  const progress = options.progress ?? null;
  const progressResolution = progress ? resolveProgress(progress, options.cwd ?? process.cwd()) : null;
  const status = String(progress?.data?.status ?? "").toLowerCase();
  const inactiveStatuses = ["complete", "completed", "stopped", "blocked"];
  const activeLoop = progress?.data?.activeLoopId
    ? findLoopById(progress.data.activeLoopId, library)
    : null;
  const scheduledProgressOwnsNextAction =
    progress?.data?.recommendedNextAction &&
    (progress.data.scheduleId ||
      (status === "scheduled" && progress.data.activeLoopId && !activeLoop));

  if (scheduledProgressOwnsNextAction) {
    return {
      source: "progress",
      selected: null,
      alternatives: [],
      progress,
      progressResolution: {
        state: "scheduled",
        reason: "scheduled progress already defines the next action",
        activeLoopId: progress.data.activeLoopId ?? null,
        scheduleId: progress.data.scheduleId ?? null,
        loopName: progress.data.loopName ?? progress.data.activeLoopId ?? progress.data.scheduleId,
        status,
        nextAction: progress.data.recommendedNextAction,
      },
    };
  }

  if (progressResolution?.state === "stale-resolved") {
    const selectedLoop = findLoopById("codebase-intake-to-running-loop", library);
    const alternatives = ["release-readiness", "docs-freshness-watch"]
      .map((id) => findLoopById(id, library))
      .filter(Boolean)
      .map((loop) => ({
        loop,
        score: 0,
        reasons: ["fresh follow-up after resolved stale progress"],
        confidence: "low",
      }));
    return withWorkflow({
      source: "progress",
      selected: selectedLoop
        ? {
            loop: selectedLoop,
            score: 999,
            reasons: [progressResolution.reason],
            confidence: "high",
          }
        : null,
      alternatives,
      progress,
      progressResolution,
    });
  }

  if (progress?.data?.activeLoopId) {
    if (activeLoop && !inactiveStatuses.includes(status)) {
      return withWorkflow({
        source: "progress",
        selected: {
          loop: activeLoop,
          score: 999,
          reasons: [`active progress is still ${status || "not complete"}`],
          confidence: "high",
        },
        alternatives: rankLoops(progress.text, { library, limit: 4 }).filter((item) => item.loop.id !== activeLoop.id).slice(0, 2),
        progress,
      });
    }
  }

  const query = [options.goal, progress?.text].filter(Boolean).join("\n");
  const excludeActiveLoop =
    progress?.data?.activeLoopId && inactiveStatuses.includes(status) ? progress.data.activeLoopId : null;
  const ranked = rankLoops(query, { library, limit: library.loops.length })
    .filter((item) => item.loop.id !== excludeActiveLoop)
    .slice(0, 3);
  return withWorkflow({
    source: progress ? "progress" : "goal",
    selected: ranked[0] ?? null,
    alternatives: ranked.slice(1),
    progress,
    progressResolution,
  });
}

export function recommendPrompt(options = {}) {
  const goal = String(options.goal ?? "").trim();
  const goalRecommendation = recommendGoalTemplate({
    goal,
    category: options.category,
  });
  if (goalRecommendation.selected && goalRecommendation.selected.confidence !== "low") {
    return {
      kind: "goal-template",
      source: "goal",
      ...goalRecommendation,
    };
  }

  const loopRecommendation = recommendLoop(options);
  if (loopRecommendation.selected && loopRecommendation.selected.confidence !== "low") {
    return {
      kind: "loop",
      ...loopRecommendation,
    };
  }

  return {
    kind: "custom",
    source: "goal",
    selected: null,
    alternatives: [],
    reason: "No loop goal or advanced loop matched with enough confidence.",
    prompt: compileCustomPrompt(goal),
  };
}

export function compileCustomPrompt(goal) {
  const objective = sanitizePromptObjective(goal, { label: "Goal" });
  const prompt = `Run this as a bounded Loop It task in the current workspace.

Goal
${objective}

First inspect only the context needed to identify the smallest useful local artifact or scoped change. If the intended result or proof boundary is genuinely unclear, ask one targeted question before acting.

Use at most 3 focused passes. After each pass, compare the result with the goal, record concrete evidence, and continue only when another pass has a clear expected improvement.

Do not claim completion without reviewable evidence. Stop when the result is supported, the iteration cap is reached, the same weakness repeats twice, required context is unavailable, or approval is needed.

Keep production writes, external messages, publishing, deploys, purchases, credential changes, destructive git operations, and irreversible changes behind explicit approval. Do not ask me to run or copy terminal commands.

Return the artifact or changed files, evidence, assumptions, blockers, remaining risks, and the next safe action.`;
  assertPromptText(prompt, "Custom loop prompt");
  return prompt;
}

export function evaluateLibrary(options = {}) {
  const library = options.library ?? loadLibrary();
  const evals = options.evals ?? loadEvals();
  const loopIds = new Set(library.loops.map((loop) => loop.id));
  const coveredLoopIds = new Set();
  const results = evals.scenarios.map((scenario, index) => {
    const recommendation = recommendLoop({ goal: scenario.goal, library });
    const actualLoopId = recommendation.selected?.loop?.id ?? null;
    const passed = actualLoopId === scenario.expectedLoopId;
    if (scenario.expectedLoopId) {
      coveredLoopIds.add(scenario.expectedLoopId);
    }
    return {
      index: index + 1,
      goal: scenario.goal,
      expectedLoopId: scenario.expectedLoopId,
      actualLoopId,
      confidence: recommendation.selected?.confidence ?? "low",
      score: recommendation.selected?.score ?? 0,
      passed,
      reason: scenario.reason,
      matchedSignals: recommendation.decision?.matchedSignals ?? [],
    };
  });
  const failures = results.filter((result) => !result.passed);
  const missingLoopIds = [...loopIds].filter((loopId) => !coveredLoopIds.has(loopId));

  return {
    version: evals.version,
    ok: failures.length === 0 && missingLoopIds.length === 0,
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    missingLoopIds,
    results,
  };
}

export function loopDefaults(loop) {
  return {
    name: loop.title,
    objective: loop.defaultObjective,
    check: loop.defaultCheck,
    maxIterations: String(loop.maxIterations),
    stop: loop.stopConditions.join("; "),
    approval: loop.approvalGates.join(", "),
  };
}

export function loopWorkflow(loop) {
  return {
    choose: loop.userGuide?.useWhen ?? first(loop.bestFor) ?? loop.summary,
    startWith: loop.userGuide?.starterRequest ?? loop.defaultObjective,
    firstStep: loop.userGuide?.firstStep ?? "State the goal, check, scope, and current blocker.",
    proofTip: loop.userGuide?.proofTip ?? loop.defaultCheck,
    notFor: loop.userGuide?.notFor ?? first(loop.avoidWhen) ?? "Do not use when the goal or proof is unclear.",
    prompt: compileLoopPrompt(loop),
    proof: loop.userGuide?.proofTip ?? loop.defaultCheck,
    track:
      "Record the result, evidence, blockers, remaining risks, and recommended next action.",
    next: "Continue only when another pass has a clear expected improvement.",
  };
}

export function compileLoopPrompt(loop, options = {}) {
  const objective = sanitizePromptObjective(options.goal, {
    fallback: loop.defaultObjective,
    label: "Loop goal",
  });
  const proof = loop.userGuide?.proofTip ?? loop.defaultCheck;
  const stop = loop.stopConditions.map((condition) => `- ${condition}`).join("\n");
  const approvals = loop.approvalGates.map((gate) => `- ${gate}`).join("\n");
  const prompt = `Run this as a bounded Loop It task in the current workspace.

Goal
${objective}

Selected loop
${loop.title}: ${loop.summary}

Proof required
${proof}

Use at most ${loop.maxIterations} focused passes. Inspect the smallest relevant context, take one scoped action, verify the result, record evidence, and continue only when another pass has a clear expected improvement.

Stop when
${stop}

Approval required before
${approvals}

Do not ask me to run or copy terminal commands. Handle safe local verification inside the agent workflow and return the evidence, changed files or artifacts, blockers, remaining risks, and next safe action.`;
  assertPromptText(prompt, loop.id);
  return prompt;
}

function withWorkflow(recommendation) {
  if (!recommendation.selected?.loop) {
    return recommendation;
  }
  return {
    ...recommendation,
    workflow: loopWorkflow(recommendation.selected.loop),
    decision: recommendationDecision(recommendation.selected, recommendation.alternatives ?? []),
  };
}

function first(values) {
  return Array.isArray(values) && values.length > 0 ? values[0] : null;
}

function scoreLoop(loop, tokens, rawQuery, library) {
  const loweredQuery = String(rawQuery ?? "").toLowerCase();
  const corpus = [
    loop.id,
    loop.title,
    loop.category,
    loop.loopType,
    loop.summary,
    ...(loop.aliases ?? []),
    ...(loop.bestFor ?? []),
    ...(loop.defaultObjective ? [loop.defaultObjective] : []),
    ...(loop.defaultCheck ? [loop.defaultCheck] : []),
    ...(loop.requiredSignals ?? []),
    ...(loop.goodExamples ?? []),
    ...(loop.exampleChecks ?? []),
    loop.userGuide?.plainLanguage,
    loop.userGuide?.useWhen,
    loop.userGuide?.starterRequest,
    loop.userGuide?.firstStep,
    loop.userGuide?.proofTip,
    loop.userGuide?.notFor,
    ...((loop.progressSignals && loop.progressSignals.keywords) ?? []),
  ]
    .join(" ")
    .toLowerCase();

  let total = 0;
  const reasons = new Set();

  if (loweredQuery.includes(loop.id)) {
    total += 12;
    reasons.add(`matched loop id "${loop.id}"`);
  }

  if (loweredQuery.includes(loop.title.toLowerCase())) {
    total += 10;
    reasons.add(`matched title "${loop.title}"`);
  }

  for (const alias of loop.aliases ?? []) {
    if (matchesPhrase(loweredQuery, alias)) {
      total += 8;
      reasons.add(`matched alias "${alias}"`);
    }
  }

  for (const example of loop.goodExamples ?? []) {
    if (matchesPhrase(loweredQuery, example)) {
      total += 12;
      reasons.add(`matched example "${example}"`);
    }
  }

  for (const signal of loop.requiredSignals ?? []) {
    if (matchesPhrase(loweredQuery, signal)) {
      total += 5;
      reasons.add(`matched required signal "${signal}"`);
    }
  }

  for (const example of loop.badExamples ?? []) {
    if (matchesPhrase(loweredQuery, example)) {
      total -= 8;
      reasons.add(`matched avoid example "${example}"`);
    }
  }

  for (const candidate of library.loops) {
    for (const misroute of candidate.commonMisroutes ?? []) {
      if (!matchesPhrase(loweredQuery, misroute.query)) {
        continue;
      }

      if (misroute.preferLoopId === loop.id) {
        total += 10;
        reasons.add(`preferred over common misroute "${misroute.query}"`);
      } else if (candidate.id === loop.id && misroute.preferLoopId) {
        total -= 10;
        reasons.add(`common misroute prefers ${misroute.preferLoopId}`);
      }
    }
  }

  for (const token of tokens) {
    if (normalizeId(loop.id).includes(token)) {
      total += 4;
      reasons.add("matched id tokens");
    }
    if (loop.title.toLowerCase().includes(token)) {
      total += 3;
      reasons.add("matched title tokens");
    }
    if (String(loop.category).toLowerCase().includes(token)) {
      total += 2;
      reasons.add(`matched ${loop.category} category`);
    }
    if (String(loop.loopType ?? "").toLowerCase().includes(token)) {
      total += 2;
      reasons.add(`matched ${loop.loopType} loop type`);
    }
    if (corpus.includes(token)) {
      total += 1;
    }
  }

  return {
    total,
    reasons: [...reasons],
  };
}

function recommendationDecision(selected, alternatives) {
  return {
    confidence: selected.confidence ?? confidenceFor(selected, alternatives[0] ?? null),
    matchedSignals: selected.reasons ?? [],
    whyNotAlternatives: alternatives.slice(0, 2).map((alternative) => ({
      loopId: alternative.loop.id,
      title: alternative.loop.title,
      reason: alternative.score > 0
        ? `Lower score (${alternative.score}) from ${alternative.reasons.join(", ") || "weaker signal match"}.`
        : "No strong matching signal in the goal or progress state.",
    })),
    clarifyingQuestion:
      (selected.confidence ?? confidenceFor(selected, alternatives[0] ?? null)) === "low"
        ? first(selected.loop.questions)
        : null,
  };
}

function confidenceFor(item, nextItem) {
  if (!item || item.score <= 0) {
    return "low";
  }

  const gap = item.score - (nextItem?.score ?? 0);
  if (item.score >= 18 && gap >= 6) {
    return "high";
  }
  if (item.score >= 8 && gap >= 3) {
    return "medium";
  }
  return "low";
}

function matchesPhrase(loweredQuery, phrase) {
  const phraseTokens = tokenize(phrase);
  if (phraseTokens.length === 0) {
    return false;
  }
  const queryTokens = tokenize(loweredQuery);
  if (phraseTokens.length === 1) {
    return queryTokens.includes(phraseTokens[0]);
  }
  const normalizedQuery = ` ${queryTokens.join(" ")} `;
  const normalizedPhrase = ` ${phraseTokens.join(" ")} `;
  return normalizedQuery.includes(normalizedPhrase) || phraseTokens.every((token) => queryTokens.includes(token));
}

function progressText(data) {
  return [
    data.activeLoopId,
    data.loopName,
    data.status,
    data.objective,
    data.lastCheck,
    data.lastResult,
    ...(Array.isArray(data.blockers) ? data.blockers : []),
    ...(Array.isArray(data.remainingRisks) ? data.remainingRisks : []),
    data.recommendedNextAction,
  ]
    .filter(Boolean)
    .join("\n");
}

function progressFromMarkdown(markdown) {
  const status = markdown.match(/^Status:\s*(.+)$/im)?.[1]?.trim();
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const objective = section(markdown, "Objective");
  const check = markdown.match(/Primary check:\s*(.+)$/im)?.[1]?.trim();
  const recommendedNextAction = markdown.match(/Recommended next action:\s*(.+)$/im)?.[1]?.trim();
  return {
    status,
    loopName: title,
    objective,
    lastCheck: check,
    recommendedNextAction,
  };
}

function resolveProgress(progress, cwd) {
  const data = progress?.data ?? {};
  const text = progress?.text ?? "";
  const status = String(data.status ?? "").toLowerCase();
  const inactiveStatuses = new Set(["blocked", "complete", "completed", "stopped"]);
  if (!inactiveStatuses.has(status) || !isReleaseProgress(data, text)) {
    return null;
  }

  const versions = referencedVersions(text);
  const targetVersion = versions.length ? maxVersion(versions) : null;
  if (!targetVersion) {
    return null;
  }

  const packageInfo = readPackageInfo(cwd);
  const npmLatestVersion = packageInfo?.name ? readNpmLatestVersion(packageInfo.name) : null;
  const packageMovedPastTarget = packageInfo?.version && compareVersions(packageInfo.version, targetVersion) > 0;
  const npmPublishedTarget = npmLatestVersion && compareVersions(npmLatestVersion, targetVersion) >= 0;

  if (!packageMovedPastTarget && !npmPublishedTarget) {
    return {
      state: "unresolved",
      reason: `release progress still targets ${targetVersion}`,
      activeLoopId: data.activeLoopId ?? null,
      targetVersion,
      packageVersion: packageInfo?.version ?? null,
      npmLatestVersion,
    };
  }

  const proof = npmPublishedTarget
    ? `npm latest ${npmLatestVersion} is at or past ${targetVersion}`
    : `package.json ${packageInfo.version} moved past ${targetVersion}`;
  return {
    state: "stale-resolved",
    reason: `stale release progress ignored because ${proof}`,
    activeLoopId: data.activeLoopId ?? null,
    targetVersion,
    packageVersion: packageInfo?.version ?? null,
    npmLatestVersion,
  };
}

function isReleaseProgress(data, text) {
  const lowered = [data.activeLoopId, data.loopName, data.objective, data.verifier, text]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return (
    lowered.includes("release-readiness") ||
    lowered.includes("release readiness") ||
    lowered.includes("npm publish") ||
    lowered.includes("npm latest") ||
    lowered.includes("npm view") ||
    lowered.includes("publish")
  );
}

function referencedVersions(text) {
  return [...String(text ?? "").matchAll(/\b\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/g)].map((match) => match[0]);
}

function maxVersion(versions) {
  return versions.reduce((max, version) => (compareVersions(version, max) > 0 ? version : max), versions[0]);
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) {
      return a[i] > b[i] ? 1 : -1;
    }
  }
  return 0;
}

function versionParts(version) {
  return String(version ?? "")
    .split(/[+-]/)[0]
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function readPackageInfo(cwd) {
  const packagePath = resolve(cwd, "package.json");
  if (!existsSync(packagePath)) {
    return null;
  }
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  return {
    name: typeof packageJson.name === "string" ? packageJson.name : null,
    version: typeof packageJson.version === "string" ? packageJson.version : null,
  };
}

function readNpmLatestVersion(packageName) {
  if (process.env.LOOP_IT_NPM_LATEST_VERSION) {
    return process.env.LOOP_IT_NPM_LATEST_VERSION;
  }
  if (process.env.LOOP_IT_SKIP_NPM_VIEW === "1") {
    return null;
  }
  const result = spawnSync("npm", ["view", packageName, "version", "--silent"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5000,
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

function section(markdown, heading) {
  const pattern = new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=\\n## |\\n# |$)`, "m");
  return markdown.match(pattern)?.[1]?.trim();
}

function tokenize(input) {
  return String(input ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function normalizeId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function parseArgs(tokens) {
  const args = { _: [] };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    if (["json"].includes(key)) {
      args[key] = true;
      continue;
    }

    const value = tokens[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function printList(args) {
  const library = loadLibrary();
  const loops = args.category ? library.loops.filter((loop) => loop.category === args.category) : library.loops;
  if (args.json) {
    printJson({ version: library.version, loops });
    return;
  }

  for (const loop of loops) {
    console.log(`${loop.id}  ${loop.title}  [${loop.category}; ${loop.loopType ?? "unclassified"}]`);
    console.log(`  ${loop.summary}`);
    if (loop.userGuide?.useWhen) {
      console.log(`  Use when: ${loop.userGuide.useWhen}`);
    }
  }
}

function printSearch(args) {
  const query = args.query ?? args._.join(" ");
  if (!query.trim()) {
    throw new Error("Provide a search query.");
  }

  const results = rankLoops(query, { limit: 5 });
  if (args.json) {
    printJson({ query, results });
    return;
  }
  printRanked(`Search results for "${query}"`, results);
}

function printShow(args) {
  const id = args.id ?? args._[0];
  if (!id) {
    throw new Error("Provide a loop id.");
  }

  const loop = findLoopById(id);
  if (!loop) {
    throw new Error(`Unknown loop id: ${id}`);
  }

  if (args.json) {
    printJson({ loop });
    return;
  }

  console.log(`${loop.title} (${loop.id})`);
  console.log(`Type: ${loop.loopType ?? "unclassified"}; Category: ${loop.category}`);
  console.log(loop.summary);
  console.log("");
  if (loop.userGuide) {
    console.log("Plain English:");
    console.log(loop.userGuide.plainLanguage);
    console.log(`Use when: ${loop.userGuide.useWhen}`);
    console.log(`Start with: ${loop.userGuide.starterRequest}`);
    console.log(`First step: ${loop.userGuide.firstStep}`);
    console.log(`Proof tip: ${loop.userGuide.proofTip}`);
    console.log(`Not for: ${loop.userGuide.notFor}`);
    console.log("");
  }
  console.log(`Default objective: ${loop.defaultObjective}`);
  console.log(`Default check: ${loop.defaultCheck}`);
  console.log(`Max iterations: ${loop.maxIterations}`);
  console.log("");
  console.log("Workflow:");
  const workflow = loopWorkflow(loop);
  console.log(`1. Choose: ${workflow.choose}`);
  console.log(`2. Start with: ${workflow.startWith}`);
  console.log(`3. First step: ${workflow.firstStep}`);
  console.log(`4. Prove: ${workflow.proof}`);
  console.log(`5. Track: ${workflow.track}`);
  console.log(`6. Next: ${workflow.next}`);
  console.log("");
  console.log("Generated prompt:");
  console.log(workflow.prompt);
  console.log("");
  console.log("Questions if context is unclear:");
  for (const question of loop.questions.slice(0, 3)) {
    console.log(`- ${question}`);
  }
}

function printRecommend(args) {
  const goal = args.goal ?? args._.join(" ");
  if (!goal.trim()) {
    throw new Error("Provide --goal or a positional goal.");
  }

  const recommendation = recommendPrompt({ goal, category: args.category });
  if (args.json) {
    printJson(recommendation);
    return;
  }
  printRecommendation(recommendation, goal);
}

function printNext(args) {
  const cwd = resolve(args.cwd ?? process.cwd());
  const progress = readProgress(cwd);
  if (!progress) {
    const payload = {
      source: "none",
      selected: null,
      alternatives: [],
      questions: [
        "What are you trying to improve next?",
        "What proof would convince you it is done?",
        "What is the current blocker or last result?",
      ],
    };
    if (args.json) {
      printJson(payload);
      return;
    }
    console.log(`No .loop-it progress file found under ${cwd}.`);
    console.log("Ask these questions before selecting a loop:");
    for (const question of payload.questions) {
      console.log(`- ${question}`);
    }
    return;
  }

  const recommendation = recommendLoop({ progress, cwd });
  if (args.json) {
    printJson(recommendation);
    return;
  }
  printRecommendation(recommendation, `progress from ${progress.source}`);
}

function printEval(args) {
  const report = evaluateLibrary();
  if (args.json) {
    printJson(report);
  } else {
    console.log(`Loop library evals: ${report.passed}/${report.total} passed`);
    if (report.missingLoopIds.length) {
      console.log(`Missing scenario coverage: ${report.missingLoopIds.join(", ")}`);
    }
    for (const result of report.results) {
      const mark = result.passed ? "PASS" : "FAIL";
      console.log(`${mark} ${result.index}. ${result.goal}`);
      console.log(`  expected: ${result.expectedLoopId}`);
      console.log(`  actual: ${result.actualLoopId ?? "none"} (${result.confidence}, score ${result.score})`);
      if (!result.passed && result.matchedSignals.length) {
        console.log(`  signals: ${result.matchedSignals.join(", ")}`);
      }
    }
  }

  if (!report.ok) {
    process.exit(1);
  }
}

function printRanked(title, results) {
  console.log(title);
  for (const item of results) {
    console.log(`- ${item.loop.id}: ${item.loop.title} (${item.score})`);
    console.log(`  ${item.loop.summary}`);
    if (item.loop.userGuide?.plainLanguage) {
      console.log(`  Plain English: ${item.loop.userGuide.plainLanguage}`);
    }
    console.log(`  Proof: ${item.loop.userGuide?.proofTip ?? item.loop.defaultCheck}`);
    console.log(`  Confidence: ${item.confidence}`);
    console.log(`  Start with: ${loopWorkflow(item.loop).startWith}`);
    if (item.reasons.length > 0) {
      console.log(`  Why: ${item.reasons.join(", ")}`);
    }
  }
}

function printRecommendation(recommendation, sourceLabel) {
  if (recommendation.kind === "custom") {
    console.log("No confident library match.");
    console.log(`Reason: ${recommendation.reason}`);
    console.log("");
    console.log(recommendation.prompt);
    return;
  }

  if (recommendation.kind === "goal-template") {
    const { goal, score, confidence, reasons } = recommendation.selected;
    console.log(`Recommended loop goal: ${goal.title} (${goal.id})`);
    console.log(`Category: ${goal.category}`);
    console.log(`Confidence: ${confidence}`);
    console.log(`Score: ${score}`);
    if (reasons.length > 0) {
      console.log(`Why: ${reasons.join(", ")}`);
    }
    console.log("");
    console.log(compileGoalPrompt(goal, { goal: sourceLabel }));
    return;
  }

  if (!recommendation.selected) {
    if (recommendation.progressResolution?.state === "scheduled") {
      const progress = recommendation.progressResolution;
      console.log(`Active progress: ${progress.loopName} (${progress.status})`);
      console.log(`Source: ${sourceLabel}`);
      console.log(`Next action: ${progress.nextAction}`);
      console.log("No new loop recommended.");
      return;
    }
    console.log("No matching loop found.");
    return;
  }

  const { loop, score, reasons } = recommendation.selected;
  console.log(`Recommended loop: ${loop.title} (${loop.id})`);
  console.log(`Source: ${sourceLabel}`);
  console.log(`Score: ${score}`);
  if (recommendation.decision?.confidence) {
    console.log(`Confidence: ${recommendation.decision.confidence}`);
  }
  if (reasons.length > 0) {
    console.log(`Why: ${reasons.join(", ")}`);
  }
  console.log("");
  const workflow = recommendation.workflow ?? loopWorkflow(loop);
  console.log("How to use it:");
  if (loop.userGuide?.plainLanguage) {
    console.log(`Plain English: ${loop.userGuide.plainLanguage}`);
  }
  console.log(`1. Use when: ${workflow.choose}`);
  console.log(`2. Start with: ${workflow.startWith}`);
  console.log(`3. First step: ${workflow.firstStep}`);
  console.log(`4. Prove: ${workflow.proof}`);
  console.log(`5. Proof tip: ${workflow.proofTip}`);
  console.log(`6. Track: ${workflow.track}`);
  console.log(`7. Next: ${workflow.next}`);
  console.log(`Not for: ${workflow.notFor}`);
  console.log("");
  console.log("Generated prompt:");
  console.log(workflow.prompt);
  console.log("");
  console.log("Questions if this is still unclear:");
  for (const question of loop.questions.slice(0, 3)) {
    console.log(`- ${question}`);
  }

  if (recommendation.decision?.whyNotAlternatives?.length) {
    console.log("");
    console.log("Why not the alternatives:");
    for (const item of recommendation.decision.whyNotAlternatives) {
      console.log(`- ${item.title}: ${item.reason}`);
    }
  }

  if (recommendation.alternatives.length > 0) {
    console.log("");
    console.log("Alternatives:");
    for (const alternative of recommendation.alternatives) {
      console.log(`- ${alternative.loop.id}: ${alternative.loop.title}`);
    }
  }
}

function printUsage() {
  console.log(`Usage:
  select-loop.mjs list [--category engineering] [--json]
  select-loop.mjs search "failing ci" [--json]
  select-loop.mjs recommend --goal "fix failing checkout test" [--json]
  select-loop.mjs next --cwd <project> [--json]
  select-loop.mjs eval [--json]
  select-loop.mjs show <loop-id> [--json]`);
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function main() {
  const [command, ...tokens] = process.argv.slice(2);
  if (!command || ["help", "--help", "-h"].includes(command)) {
    printUsage();
    return;
  }

  const args = parseArgs(tokens);
  if (command === "list") {
    printList(args);
  } else if (command === "search") {
    printSearch(args);
  } else if (command === "show") {
    printShow(args);
  } else if (command === "recommend") {
    printRecommend(args);
  } else if (command === "next") {
    printNext(args);
  } else if (command === "eval") {
    printEval(args);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
