#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");
const libraryPath = resolve(skillRoot, "references", "library", "loops.json");
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
      const score = scoreLoop(loop, tokens, query);
      return {
        loop,
        score: score.total,
        reasons: score.reasons,
      };
    })
    .sort((a, b) => b.score - a.score || a.loop.title.localeCompare(b.loop.title));

  return ranked.slice(0, limit);
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
  const status = String(progress?.data?.status ?? "").toLowerCase();
  const inactiveStatuses = ["complete", "completed", "stopped", "blocked"];

  if (progress?.data?.activeLoopId) {
    const activeLoop = findLoopById(progress.data.activeLoopId, library);
    if (activeLoop && !inactiveStatuses.includes(status)) {
      return withWorkflow({
        source: "progress",
        selected: {
          loop: activeLoop,
          score: 999,
          reasons: [`active progress is still ${status || "not complete"}`],
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
  });
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
  const goal = shellQuote(loop.defaultObjective);
  const check = shellQuote(loop.defaultCheck);
  return {
    choose: first(loop.bestFor) ?? loop.summary,
    write: `loop-it write --from ${loop.id} --goal ${goal} --check ${check}`,
    start: `loop-it start --from ${loop.id} --goal ${goal} --check ${check}`,
    create: `loop-it write --from ${loop.id} --goal ${goal} --check ${check}`,
    proof: loop.defaultCheck,
    track:
      "Update .loop-it/progress.json with lastResult, blockers, remainingRisks, and recommendedNextAction.",
    next: "Run loop-it next --cwd . when the loop is complete, stopped, or blocked.",
  };
}

function withWorkflow(recommendation) {
  if (!recommendation.selected?.loop) {
    return recommendation;
  }
  return {
    ...recommendation,
    workflow: loopWorkflow(recommendation.selected.loop),
  };
}

function first(values) {
  return Array.isArray(values) && values.length > 0 ? values[0] : null;
}

function shellQuote(value) {
  return `"${String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function scoreLoop(loop, tokens, rawQuery) {
  const loweredQuery = String(rawQuery ?? "").toLowerCase();
  const corpus = [
    loop.id,
    loop.title,
    loop.category,
    loop.summary,
    ...(loop.aliases ?? []),
    ...(loop.bestFor ?? []),
    ...(loop.defaultObjective ? [loop.defaultObjective] : []),
    ...(loop.defaultCheck ? [loop.defaultCheck] : []),
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
    const loweredAlias = alias.toLowerCase();
    if (loweredQuery.includes(loweredAlias)) {
      total += 8;
      reasons.add(`matched alias "${alias}"`);
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
    if (corpus.includes(token)) {
      total += 1;
    }
  }

  return {
    total,
    reasons: [...reasons],
  };
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
    console.log(`${loop.id}  ${loop.title}  [${loop.category}]`);
    console.log(`  ${loop.summary}`);
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
  console.log(loop.summary);
  console.log("");
  console.log(`Default objective: ${loop.defaultObjective}`);
  console.log(`Default check: ${loop.defaultCheck}`);
  console.log(`Max iterations: ${loop.maxIterations}`);
  console.log("");
  console.log("Workflow:");
  const workflow = loopWorkflow(loop);
  console.log(`1. Choose: ${workflow.choose}`);
  console.log(`2. Write: ${workflow.write}`);
  console.log(`3. Launch: ${workflow.start}`);
  console.log(`4. Track: ${workflow.track}`);
  console.log(`5. Next: ${workflow.next}`);
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

  const recommendation = recommendLoop({ goal });
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

  const recommendation = recommendLoop({ progress });
  if (args.json) {
    printJson(recommendation);
    return;
  }
  printRecommendation(recommendation, `progress from ${progress.source}`);
}

function printRanked(title, results) {
  console.log(title);
  for (const item of results) {
    console.log(`- ${item.loop.id}: ${item.loop.title} (${item.score})`);
    console.log(`  ${item.loop.summary}`);
    console.log(`  Proof: ${item.loop.defaultCheck}`);
    console.log(`  Write: ${loopWorkflow(item.loop).write}`);
    if (item.reasons.length > 0) {
      console.log(`  Why: ${item.reasons.join(", ")}`);
    }
  }
}

function printRecommendation(recommendation, sourceLabel) {
  if (!recommendation.selected) {
    console.log("No matching loop found.");
    return;
  }

  const { loop, score, reasons } = recommendation.selected;
  console.log(`Recommended loop: ${loop.title} (${loop.id})`);
  console.log(`Source: ${sourceLabel}`);
  console.log(`Score: ${score}`);
  if (reasons.length > 0) {
    console.log(`Why: ${reasons.join(", ")}`);
  }
  console.log("");
  const workflow = recommendation.workflow ?? loopWorkflow(loop);
  console.log("How to use it:");
  console.log(`1. Choose: ${workflow.choose}`);
  console.log(`2. Write: ${workflow.write}`);
  console.log(`3. Launch: ${workflow.start}`);
  console.log(`4. Prove: ${workflow.proof}`);
  console.log(`5. Track: ${workflow.track}`);
  console.log(`6. Next: ${workflow.next}`);
  console.log("");
  console.log("Questions if this is still unclear:");
  for (const question of loop.questions.slice(0, 3)) {
    console.log(`- ${question}`);
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
