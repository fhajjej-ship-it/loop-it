#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");
const goalLibraryPath = resolve(skillRoot, "references", "library", "goals.json");
const goalEvalsPath = resolve(skillRoot, "references", "library", "goals-evals.json");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const commandBoundary = String.raw`(?=\s*(?:$|["'\`,.;!?)]|&&|\|\||\bthen\b|\band\s+(?:report|summarize|continue|fix|rerun|record|capture)\b))`;
const commandRules = [
  {
    source: String.raw`\b(?:npm|pnpm|yarn|bun)\s+(?:(?:run|exec)\s+)?(?:test|check|build|lint)(?:(?:\s+--\s+[a-z0-9_./:-]+)|(?:\s+--?[a-z0-9][a-z0-9_./:=*-]*))*`,
    replacement: "project checks",
  },
  {
    source: String.raw`(?:\brun\s+)?\b(?:npm|pnpm|yarn|bun)\s+(?:(?:run|exec)\s+)?publish(?:(?:\s+--\s+[a-z0-9_./:-]+)|(?:\s+--?[a-z0-9][a-z0-9_./:=*-]*))*`,
    replacement: "publish the package",
  },
  {
    source: String.raw`(?:\brun\s+)?\b(?:npm|pnpm|yarn|bun)\s+(?:(?:run|exec)\s+)?deploy(?:(?:\s+--\s+[a-z0-9_./:-]+)|(?:\s+--?[a-z0-9][a-z0-9_./:=*-]*))*`,
    replacement: "deploy the project",
  },
  {
    source: String.raw`(?:\brun\s+)?\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove)(?:(?:\s+--\s+[a-z0-9_./:@-]+)|(?:\s+--?[a-z0-9][a-z0-9_./:@=*-]*))*`,
    replacement: "update project dependencies",
  },
  {
    source: String.raw`(?:\brun\s+)?\b(?:npm|pnpm|yarn|bun)\s+(?:start|dev)(?:(?:\s+--\s+[a-z0-9_./:-]+)|(?:\s+--?[a-z0-9][a-z0-9_./:=*-]*))*`,
    replacement: "start the project",
  },
  {
    source: String.raw`(?:\brun\s+)?\b(?:npm|pnpm|yarn|bun)\s+(?:create)(?:(?:\s+--\s+[a-z0-9_./:@-]+)|(?:\s+--?[a-z0-9][a-z0-9_./:@=*-]*))*`,
    replacement: "create the project",
  },
  {
    source: String.raw`\b(?:npm|pnpm|yarn|bun)\s+(?:run|exec|dlx|x)\s+[a-z0-9_./:@-]+(?:(?:\s+--\s+[a-z0-9_./:@-]+)|(?:\s+--?[a-z0-9][a-z0-9_./:@=*-]*))*`,
    replacement: "project task",
  },
  {
    // A capitalized “Make …” is ordinary prose; the lowercase executable is command-shaped
    // only when its target ends like a command instead of continuing as a noun phrase.
    source: String.raw`\bmake\s+(?:test|check|build|run)(?:(?:\s+--\s+[a-z0-9_./:-]+)|(?:\s+--?[a-z0-9][a-z0-9_./:=*-]*))*${commandBoundary}`,
  },
  {
    source: String.raw`\b(?:dotnet|swift|cargo)\s+(?:test|check|build|run)(?:(?:\s+--\s+[a-z0-9_./:-]+)|(?:\s+--?[a-z0-9][a-z0-9_./:=*-]*))*${commandBoundary}`,
  },
  {
    source: String.raw`\bpytest(?:\s+(?:\.{0,2}/)?[a-z0-9_.:/-]+)*(?:(?:\s+--\s+[a-z0-9_./:-]+)|(?:\s+--?[a-z0-9][a-z0-9_./:=*-]*))*${commandBoundary}`,
  },
  {
    // Preserve natural prose such as “Go build a clickable prototype.”
    source: String.raw`\bgo\s+(?:test|build|run)(?:\s+(?:(?:\.{1,2}/|[a-z0-9_.-]+/)[a-z0-9_./-]*|[a-z0-9_.-]+\.go))?(?:(?:\s+--\s+[a-z0-9_./:-]+)|(?:\s+--?[a-z0-9][a-z0-9_./:=*-]*))*${commandBoundary}`,
  },
  {
    source: String.raw`\b(?:python(?:3(?:\.\d+)*)?|py)\s+(?:(?:-[a-zA-Z][a-zA-Z0-9-]*(?:=[^\s,.;]+)?\s+)*)?(?:\.{0,2}/)?[a-zA-Z0-9_./-]+\.py(?:(?:\s+--\s+[a-zA-Z0-9_./:-]+)|(?:\s+--?[a-zA-Z0-9][a-zA-Z0-9_./:=*-]*))*`,
  },
  {
    source: String.raw`\bgit\s+(?:status|diff|log|show|branch|rev-parse)(?:(?:\s+--\s+[a-zA-Z0-9_./:-]+)|(?:\s+--?[a-zA-Z0-9][a-zA-Z0-9_./:=*-]*))*${commandBoundary}`,
  },
  {
    source: String.raw`\bkubectl\s+(?:get|describe|logs|wait|rollout)\s+[a-zA-Z0-9_./:-]+(?:(?:\s+--\s+[a-zA-Z0-9_./:-]+)|(?:\s+--?[a-zA-Z0-9][a-zA-Z0-9_./:=*-]*))*${commandBoundary}`,
  },
];
const executableNames = String.raw`(?:npm|pnpm|yarn|bun|npx|codex|loop-it|make|dotnet|swift|cargo|pytest|go|python(?:3(?:\.\d+)*)?|py|git|kubectl|pip3?|sudo|rm|rmdir|curl|wget|docker|podman|terraform|helm|gh|aws|gcloud|az|bash|zsh|sh|powershell|pwsh|ls|pwd|cat|grep|sed|awk|tee|head|tail|xargs)`;
const unsupportedPromptPatterns = [
  new RegExp(String.raw`\`{3}(?:sh|bash|zsh|shell|console|terminal|powershell|pwsh|cmd)?\s*(?:\$\s*)?${executableNames}\b`, "i"),
  new RegExp(String.raw`\`\s*(?:\$\s*)?${executableNames}\b[^\`\n]*\``, "i"),
  /(?:&&|\|\|)/,
  new RegExp(String.raw`\b(?:${executableNames}|project checks)\b[^\n.;!?]*\s\|\s[^\n.;!?]+`, "i"),
  /(?:^|\s)(?:>>?|<)\s*(?:[./~]|[a-z0-9_-]+\.)[a-z0-9_./~-]*/i,
  /\$\([^)]*\)/,
  /\b(?:sudo\s+)?(?:rm|rmdir|mkfs|chmod|chown)\s+(?:-[^\s,.;!?]+\s+)*[^\s,.;!?]+/i,
  /\b(?:del|erase|format)\s+(?:\/[a-z?]+\s+)*(?:[a-z]:|[./~][^\s,.;!?]+|[^\s,.;!?]+\.[a-z0-9]+)\b/i,
  /\bgit\s+(?:add|apply|checkout|switch|restore|reset|clean|commit|push|pull|fetch|merge|rebase|cherry-pick|revert|tag|stash|worktree)\b/i,
  /\b(?:python(?:3(?:\.\d+)*)?\s+-m\s+)?pip3?\s+(?:install|uninstall|check|freeze|list|download|wheel)\b/i,
  /\b(?:curl|wget|docker|podman|terraform|ansible|helm|gh|aws|gcloud|az)\s+[^\s,.;!?]+/i,
  /\b(?:sudo\s+)?(?:bash|zsh|sh|powershell|pwsh)\s+(?:-[^\s,.;!?]+\s+)*[^\s,.;!?]+/i,
  /\b(?:Get|Set|New|Remove|Invoke|Start|Stop|Restart|Test|Write|Read|Clear|Copy|Move)-[A-Z][A-Za-z]+\b/,
  /\b(?:ls|pwd|cat|grep|sed|awk|tee|head|tail|xargs)\s+(?:--?[a-z0-9_-]+|[./~][^\s,.;!?]+|[^\s,.;!?]+\.[a-z0-9]+)\b/i,
];
const forbiddenPromptPatterns = [
  /\bnpx\b/i,
  /\bcodex\s+exec\b/i,
  /\bloop-it\s+(?:run|start|write|new|schedule|tick)\b/i,
  /(?:^|\s)\/(?:goal|loop-it)\b/i,
  /(?:^|\s)\$\s+[a-z]/i,
];
const libraryKeys = new Set(["version", "categories", "goals"]);
const categoryKeys = new Set(["id", "title", "description", "order"]);
const goalKeys = new Set([
  "id",
  "title",
  "category",
  "summary",
  "tags",
  "aliases",
  "loopType",
  "workflow",
  "defaultGoal",
  "requiredInputs",
  "sampleInput",
  "expectedArtifact",
  "proof",
  "maxIterations",
  "capabilities",
  "reliability",
  "approvalGates",
  "goodExamples",
  "badExamples",
]);
const inputKeys = new Set(["id", "label", "description", "required"]);
const proofKeys = new Set(["mode", "criteria", "evidence"]);
const reliabilityKeys = new Set(["status", "summary"]);
const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "in",
  "into",
  "it",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

export function loadGoalLibrary() {
  const library = JSON.parse(readFileSync(goalLibraryPath, "utf8"));
  validateGoalLibrary(library);
  return library;
}

export function loadGoalEvals() {
  const evals = JSON.parse(readFileSync(goalEvalsPath, "utf8"));
  if (!Array.isArray(evals.scenarios)) {
    throw new Error("Goal library evals are missing a scenarios array.");
  }
  return evals;
}

export function validateGoalLibrary(library) {
  if (!library || typeof library !== "object") {
    throw new Error("Goal library must be an object.");
  }
  requireOnlyKeys(library, libraryKeys, "goal library");
  requireText(library.version, "goal library version");
  if (!Array.isArray(library.categories) || library.categories.length === 0) {
    throw new Error("Goal library is missing categories.");
  }
  if (!Array.isArray(library.goals) || library.goals.length === 0) {
    throw new Error("Goal library is missing goals.");
  }

  const categoryIds = uniqueIds(library.categories, "category");
  const goalIds = uniqueIds(library.goals, "goal");
  const categoryCounts = new Map([...categoryIds].map((id) => [id, 0]));

  for (const category of library.categories) {
    requireOnlyKeys(category, categoryKeys, `category ${category?.id ?? "<missing>"}`);
    requireSlug(category.id, "category id");
    requireText(category.title, `${category.id}.title`);
    requireText(category.description, `${category.id}.description`);
    if (!Number.isInteger(category.order) || category.order < 0) {
      throw new Error(`${category.id}.order must be a non-negative integer.`);
    }
  }

  for (const goal of library.goals) {
    requireOnlyKeys(goal, goalKeys, `goal ${goal?.id ?? "<missing>"}`);
    requireSlug(goal.id, "goal id");
    if (!categoryIds.has(goal.category)) {
      throw new Error(`${goal.id} references unknown category ${goal.category}.`);
    }
    categoryCounts.set(goal.category, (categoryCounts.get(goal.category) ?? 0) + 1);
    if (!new Set(["turn-based", "goal-based"]).has(goal.loopType)) {
      throw new Error(`${goal.id}.loopType must be turn-based or goal-based.`);
    }
    if (goal.workflow !== "workspace-artifact-to-proof") {
      throw new Error(`${goal.id}.workflow is not supported.`);
    }
    for (const field of ["title", "summary", "defaultGoal", "sampleInput", "expectedArtifact"]) {
      requireText(goal[field], `${goal.id}.${field}`);
    }
    for (const field of ["tags", "aliases", "capabilities", "approvalGates"]) {
      requireStringArray(goal[field], `${goal.id}.${field}`);
    }
    requireStringArray(goal.goodExamples, `${goal.id}.goodExamples`, 3);
    requireStringArray(goal.badExamples, `${goal.id}.badExamples`, 3);
    if (!Array.isArray(goal.requiredInputs) || goal.requiredInputs.length === 0) {
      throw new Error(`${goal.id}.requiredInputs must be a non-empty array.`);
    }
    uniqueIds(goal.requiredInputs, `${goal.id} input`);
    for (const input of goal.requiredInputs) {
      requireOnlyKeys(input, inputKeys, `${goal.id} input ${input?.id ?? "<missing>"}`);
      requireSlug(input.id, `${goal.id} input id`);
      requireText(input.label, `${goal.id}.${input.id}.label`);
      requireText(input.description, `${goal.id}.${input.id}.description`);
      if (typeof input.required !== "boolean") {
        throw new Error(`${goal.id}.${input.id}.required must be boolean.`);
      }
    }
    if (!goal.proof || !new Set(["rubric", "hybrid"]).has(goal.proof.mode)) {
      throw new Error(`${goal.id}.proof.mode must be rubric or hybrid.`);
    }
    requireOnlyKeys(goal.proof, proofKeys, `${goal.id}.proof`);
    requireStringArray(goal.proof.criteria, `${goal.id}.proof.criteria`, 3);
    requireStringArray(goal.proof.evidence, `${goal.id}.proof.evidence`);
    if (!Number.isInteger(goal.maxIterations) || goal.maxIterations < 1 || goal.maxIterations > 7) {
      throw new Error(`${goal.id}.maxIterations must be between 1 and 7.`);
    }
    if (!goal.reliability || !new Set(["experimental", "tested"]).has(goal.reliability.status)) {
      throw new Error(`${goal.id}.reliability.status must be experimental or tested.`);
    }
    requireOnlyKeys(goal.reliability, reliabilityKeys, `${goal.id}.reliability`);
    requireText(goal.reliability.summary, `${goal.id}.reliability.summary`);
    assertPromptOnly(goal);
  }

  for (const [categoryId, count] of categoryCounts) {
    if (count < 2) {
      throw new Error(`Category ${categoryId} must include at least two loop goals.`);
    }
  }

  return { categoryIds, goalIds };
}

export function findGoalById(id, library = loadGoalLibrary()) {
  const normalized = normalizeId(id);
  return library.goals.find((goal) => normalizeId(goal.id) === normalized) ?? null;
}

export function rankGoalTemplates(query, options = {}) {
  const library = options.library ?? loadGoalLibrary();
  const category = options.category ? normalizeId(options.category) : null;
  const candidates = category
    ? library.goals.filter((goal) => normalizeId(goal.category) === category)
    : library.goals;
  const queryText = String(query ?? "").trim();
  const tokens = tokenize(queryText);
  const limit = Number.isInteger(options.limit) ? options.limit : candidates.length;
  const ranked = candidates
    .map((goal) => scoreGoal(goal, queryText, tokens))
    .sort((left, right) => right.score - left.score || left.goal.title.localeCompare(right.goal.title));

  return ranked.slice(0, limit).map((item, index) => ({
    ...item,
    confidence: confidenceFor(item, ranked[index + 1] ?? null),
  }));
}

export function recommendGoalTemplate(options = {}) {
  if (hasExplicitEngineeringIntent(options.goal)) {
    return {
      selected: null,
      alternatives: [],
      reason: "Explicit repository or code-verification intent should use the advanced loop library.",
    };
  }
  const ranked = rankGoalTemplates(options.goal ?? "", {
    library: options.library,
    category: options.category,
    limit: 3,
  });
  const top = ranked[0] ?? null;
  if (!top || top.score < 8) {
    return {
      selected: null,
      alternatives: ranked.filter((item) => item.score > 0).slice(0, 2),
      reason: "No loop goal matched with enough evidence.",
    };
  }
  return {
    selected: top,
    alternatives: ranked.slice(1),
    prompt: compileGoalPrompt(top.goal, { goal: options.goal }),
  };
}

export function hasExplicitEngineeringIntent(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return false;
  }

  const repositoryIntent = /\b(?:repo|repository|codebase|source\s+tree|working\s+tree|pull\s+request|merge\s+request)\b/.test(text);
  const engineeringCheck = /\b(?:ci|typecheck(?:ing)?|lint(?:ing)?|unit\s+tests?|integration\s+tests?|e2e\s+tests?|end[-\s]to[-\s]end\s+tests?|regression\s+tests?|test\s+suite|build\s+(?:job|step|script|failure)|compiler\s+error)\b/.test(text);
  const testIntent =
    /\b(?:test|tests|testing|spec|specs)\b/.test(text) &&
    /\b(?:fix|repair|debug|run|rerun|failing|failed|failure|broken|regression|coverage|assert|assertion)\b/.test(text);
  const codeChangeIntent =
    /\b(?:fix|repair|debug|implement|refactor|patch|code|add|update)\b/.test(text) &&
    /\b(?:bug|crash|exception|stack\s+trace|source\s+code|api|endpoint|function|class|module|component|package|dependency|database|migration|server|backend|frontend)\b/.test(text);

  return repositoryIntent || engineeringCheck || testIntent || codeChangeIntent;
}

export function compileGoalPrompt(goal, options = {}) {
  if (!goal) {
    throw new Error("A loop goal is required to compile a prompt.");
  }
  const objective = sanitizePromptObjective(options.goal, {
    fallback: goal.defaultGoal,
    label: "Loop goal",
  });
  const requiredInputs = goal.requiredInputs
    .map((input) => `- ${input.label}${input.required ? " (required)" : " (optional)"}: ${input.description}`)
    .join("\n");
  const criteria = goal.proof.criteria.map((criterion, index) => `${index + 1}. ${criterion}`).join("\n");
  const evidence = goal.proof.evidence.map((item) => `- ${item}`).join("\n");
  const approvals = goal.approvalGates.map((item) => `- ${item}`).join("\n");

  const prompt = `Use this goal as one complete, bounded Loop It task in the current workspace. Work toward a review-ready deliverable and return rubric evidence or a clear blocker.

Goal
${objective}

Expected deliverable
${goal.expectedArtifact}

Context to inspect
${requiredInputs}

If a required input is missing, ask one targeted question before creating the deliverable. Do not invent source material, customer evidence, measurements, or product facts.

Loop
UNDERSTAND -> CREATE -> CRITIQUE -> REFINE -> PROVE

Use at most ${goal.maxIterations} focused passes. After each pass, compare the deliverable with the proof rubric and continue only when the next pass has a clear expected improvement.

Proof rubric
${criteria}

Evidence to return
${evidence}

Stop when the rubric is satisfied, the iteration cap is reached, the same weakness repeats twice, required context is unavailable, or approval is needed. A rubric result is review-ready evidence, not automatic approval.

Approval required before
${approvals}

Keep external systems unchanged. Do not publish, send messages, contact people, deploy, purchase, or mutate production data. Do not ask me to run or copy terminal commands.

Final response
Return the review-ready deliverable or its local path when completed. Always return the rubric result for every criterion, source references, assumptions, remaining risks, and either the next safe action or a clear blocker.`;
  assertPromptText(prompt, goal.id);
  return prompt;
}

export function sanitizePromptObjective(value, options = {}) {
  const fallback = String(options.fallback ?? "").trim();
  const label = String(options.label ?? "Goal").trim() || "Goal";
  const source = String(value ?? "").trim() || fallback;
  let objective = source
    .replace(/(?:^|\s)\/(?:goal|loop-it)\b\s*/gi, " ")
    .trim();

  if (unsupportedPromptPatterns.some((pattern) => pattern.test(objective))) {
    throw new Error(
      `${label} must describe the desired outcome in natural language without terminal or slash commands. Remove the command and state the result you want.`
    );
  }

  let replacedCommand = false;
  for (const rule of commandRules) {
    const pattern = new RegExp(rule.source, "g");
    if (pattern.test(objective)) {
      replacedCommand = true;
      objective = objective.replace(new RegExp(rule.source, "g"), rule.replacement ?? "project checks");
    }
  }

  objective = objective
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();

  if (!objective || !/[a-z0-9]/i.test(objective)) {
    throw new Error(`${label} must describe the desired outcome in natural language.`);
  }

  if (replacedCommand && isOnlyGeneralizedCommand(objective)) {
    throw new Error(
      `${label} must describe the desired outcome in natural language without terminal or slash commands. Remove the command and state the result you want.`
    );
  }

  try {
    assertPromptText(objective, label);
  } catch {
    throw new Error(
      `${label} must describe the desired outcome in natural language without terminal or slash commands. Remove the command and state the result you want.`
    );
  }
  return objective;
}

export function evaluateGoalLibrary(options = {}) {
  const library = options.library ?? loadGoalLibrary();
  const evals = options.evals ?? loadGoalEvals();
  const coveredGoalIds = new Set();
  const results = evals.scenarios.map((scenario, index) => {
    const recommendation = recommendGoalTemplate({
      goal: scenario.goal,
      category: scenario.category,
      library,
    });
    const actualGoalId = recommendation.selected?.goal?.id ?? null;
    const forbidden = new Set(scenario.forbiddenGoalIds ?? []);
    const expectedMatch = actualGoalId === scenario.expectedGoalId;
    const forbiddenMatch = actualGoalId ? forbidden.has(actualGoalId) : false;
    const confidence = recommendation.selected?.confidence ?? "low";
    const minimumConfidence = scenario.minimumConfidence ?? "medium";
    const confidenceMatch = confidenceRank(confidence) >= confidenceRank(minimumConfidence);
    if (scenario.expectedGoalId) {
      coveredGoalIds.add(scenario.expectedGoalId);
    }
    return {
      index: index + 1,
      goal: scenario.goal,
      expectedGoalId: scenario.expectedGoalId,
      actualGoalId,
      confidence,
      score: recommendation.selected?.score ?? 0,
      passed: expectedMatch && !forbiddenMatch && confidenceMatch,
      reason: scenario.reason,
    };
  });
  const failures = results.filter((result) => !result.passed);
  const missingGoalIds = library.goals
    .map((goal) => goal.id)
    .filter((goalId) => !coveredGoalIds.has(goalId));
  return {
    version: evals.version,
    ok: failures.length === 0 && missingGoalIds.length === 0,
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    missingGoalIds,
    results,
  };
}

function scoreGoal(goal, rawQuery, tokens) {
  const loweredQuery = rawQuery.toLowerCase();
  const reasons = new Set();
  let score = 0;
  if (phraseMatches(loweredQuery, goal.id)) {
    score += 30;
    reasons.add("matched goal id");
  }
  if (phraseMatches(loweredQuery, goal.title)) {
    score += 25;
    reasons.add("matched title");
  }
  for (const alias of goal.aliases) {
    if (phraseMatches(loweredQuery, alias)) {
      score += 18;
      reasons.add(`matched alias "${alias}"`);
    }
  }
  for (const example of goal.goodExamples) {
    if (phraseMatches(loweredQuery, example)) {
      score += 24;
      reasons.add("matched example");
    }
  }
  for (const example of goal.badExamples) {
    if (phraseMatches(loweredQuery, example)) {
      score -= 24;
      reasons.add("matched counterexample");
    }
  }
  const corpus = tokenize([
    goal.id,
    goal.title,
    goal.category,
    goal.summary,
    goal.defaultGoal,
    goal.expectedArtifact,
    ...goal.tags,
    ...goal.aliases,
  ].join(" "));
  const corpusTokens = new Set(corpus);
  for (const token of tokens) {
    if (corpusTokens.has(token)) {
      score += 2;
      reasons.add("matched goal vocabulary");
    }
  }
  return { goal, score, reasons: [...reasons] };
}

function confidenceFor(item, nextItem) {
  if (!item || item.score < 8) {
    return "low";
  }
  const gap = item.score - (nextItem?.score ?? 0);
  if (item.score >= 24 && gap >= 6) {
    return "high";
  }
  if (item.score >= 12 && gap >= 3) {
    return "medium";
  }
  return "low";
}

function phraseMatches(loweredQuery, phrase) {
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
  if (normalizedQuery.includes(normalizedPhrase)) {
    return true;
  }
  return phraseTokens.every((token) => queryTokens.includes(token));
}

function tokenize(value) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    requireText(item?.id, `${label} id`);
    if (ids.has(item.id)) {
      throw new Error(`Duplicate ${label} id: ${item.id}`);
    }
    ids.add(item.id);
  }
  return ids;
}

function requireSlug(value, label) {
  requireText(value, label);
  if (!slugPattern.test(value)) {
    throw new Error(`${label} must be a lowercase slug.`);
  }
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function requireStringArray(value, label, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) {
    throw new Error(`${label} must include at least ${minimum} item${minimum === 1 ? "" : "s"}.`);
  }
  for (const item of value) {
    requireText(item, `${label} item`);
  }
}

function assertPromptOnly(goal) {
  const userFacingText = JSON.stringify(goal);
  assertPromptText(userFacingText, goal.id);
}

export function assertPromptText(userFacingText, goalId) {
  for (const pattern of forbiddenPromptPatterns) {
    if (pattern.test(userFacingText)) {
      throw new Error(`${goalId} contains user-facing terminal or slash-command syntax.`);
    }
  }
  for (const rule of commandRules) {
    if (new RegExp(rule.source).test(userFacingText)) {
      throw new Error(`${goalId} contains user-facing terminal or slash-command syntax.`);
    }
  }
  for (const pattern of unsupportedPromptPatterns) {
    if (pattern.test(userFacingText)) {
      throw new Error(`${goalId} contains user-facing terminal or slash-command syntax.`);
    }
  }
}

export function hasPromptCommandSyntax(value) {
  const text = String(value ?? "");
  return (
    forbiddenPromptPatterns.some((pattern) => pattern.test(text)) ||
    commandRules.some((rule) => new RegExp(rule.source).test(text)) ||
    unsupportedPromptPatterns.some((pattern) => pattern.test(text))
  );
}

function isOnlyGeneralizedCommand(value) {
  const residue = String(value)
    .replace(/\b(?:project checks|project task)\b/gi, " ")
    .replace(/\b(?:please|run|rerun|execute|use|perform|and|then|now|the|a|an|to|for|with|after|before)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, "")
    .trim();
  return residue === "";
}

function requireOnlyKeys(value, allowedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`${label} contains unsupported field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}.`);
  }
}

function normalizeId(value) {
  return String(value ?? "").trim().toLowerCase();
}

function confidenceRank(value) {
  return { low: 0, medium: 1, high: 2 }[value] ?? 0;
}

function parseArgs(tokens) {
  const args = { _: [] };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    if (key === "json") {
      args.json = true;
      continue;
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function main() {
  const [command, ...tokens] = process.argv.slice(2);
  const args = parseArgs(tokens);
  if (!command || ["help", "--help", "-h"].includes(command)) {
    console.log("Goal library actions: list, show, recommend, compile, eval");
    return;
  }
  if (command === "list") {
    const library = loadGoalLibrary();
    const goals = args.category
      ? library.goals.filter((goal) => goal.category === args.category)
      : library.goals;
    if (args.json) {
      printJson({ version: library.version, categories: library.categories, goals });
      return;
    }
    for (const goal of goals) {
      console.log(`${goal.title} — ${goal.summary}`);
    }
    return;
  }
  if (command === "show") {
    const goal = findGoalById(args.id ?? args._[0]);
    if (!goal) {
      throw new Error("Unknown loop goal.");
    }
    if (args.json) {
      printJson({ goal, prompt: compileGoalPrompt(goal) });
      return;
    }
    console.log(compileGoalPrompt(goal));
    return;
  }
  if (command === "recommend") {
    const query = args.goal ?? args._.join(" ");
    const recommendation = recommendGoalTemplate({ goal: query, category: args.category });
    if (args.json) {
      printJson(recommendation);
      return;
    }
    if (!recommendation.selected) {
      console.log(recommendation.reason);
      return;
    }
    console.log(`Recommended loop goal: ${recommendation.selected.goal.title}`);
    console.log("");
    console.log(recommendation.prompt);
    return;
  }
  if (command === "compile") {
    const goal = findGoalById(args.id ?? args._[0]);
    if (!goal) {
      throw new Error("Unknown loop goal.");
    }
    console.log(compileGoalPrompt(goal, { goal: args.goal }));
    return;
  }
  if (command === "eval") {
    const report = evaluateGoalLibrary();
    if (args.json) {
      printJson(report);
    } else {
      console.log(`Goal library evals: ${report.passed}/${report.total} passed`);
      for (const result of report.results) {
        console.log(`${result.passed ? "PASS" : "FAIL"} ${result.goal}`);
        if (!result.passed) {
          console.log(`  expected: ${result.expectedGoalId}`);
          console.log(`  actual: ${result.actualGoalId ?? "none"} (${result.confidence}, ${result.score})`);
        }
      }
    }
    if (!report.ok) {
      process.exit(1);
    }
    return;
  }
  throw new Error(`Unknown goal library action: ${command}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
