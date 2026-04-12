#!/usr/bin/env bun
/**
 * goodai-base Setup Wizard
 *
 * Usage:
 *   bun setup.ts                  Run the interactive setup wizard
 *   bun setup.ts --reconfigure    Re-run wizard over an existing install
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { homedir } from "os";
import { spawnSync } from "child_process";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const c = {
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
};

const HOME = homedir();
const GOODAI_BASE = resolve(import.meta.dir);
const CONFIG_PATH = join(GOODAI_BASE, "goodai.config.json");

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

interface ToolDef {
  id: string;
  label: string;
  skillsDir: string;
  agentsFile?: string;
  globalConfigLabel?: string;
  globalConfigPath?: string;
  globalConfigContent?: (goodaiPath: string) => string;
}

const TOOLS: ToolDef[] = [
  {
    id: "claude",
    label: "Claude Code",
    skillsDir: join(HOME, ".claude", "skills"),
    agentsFile: undefined, // handled via CLAUDE.md, not AGENTS.md copy
    globalConfigLabel: "~/.claude/CLAUDE.md",
    globalConfigPath: join(HOME, ".claude", "CLAUDE.md"),
    globalConfigContent: (goodaiPath) => CLAUDE_MD_BLOCK(goodaiPath),
  },
  {
    id: "cursor",
    label: "Cursor",
    skillsDir: join(HOME, ".cursor", "skills"),
    agentsFile: join(HOME, ".cursor", "rules", "AGENTS.md"),
    globalConfigLabel: "~/.cursor/rules/goodai-base.mdc",
    globalConfigPath: join(HOME, ".cursor", "rules", "goodai-base.mdc"),
    globalConfigContent: (goodaiPath) => CURSOR_MDC_BLOCK(goodaiPath),
  },
  {
    id: "codex",
    label: "Codex",
    skillsDir: join(HOME, ".codex", "skills"),
    agentsFile: join(HOME, ".codex", "AGENTS.md"),
    // AGENTS.md sync is sufficient for Codex
  },
  {
    id: "opencode",
    label: "OpenCode",
    skillsDir: join(HOME, ".config", "opencode", "skills"),
    agentsFile: join(HOME, ".config", "opencode", "AGENTS.md"),
    // AGENTS.md sync is sufficient for OpenCode
  },
  {
    id: "zed",
    label: "Zed",
    skillsDir: join(HOME, ".config", "zed", "skills"),
    agentsFile: join(HOME, ".config", "zed", "AGENTS.md"),
    // AGENTS.md sync is sufficient for Zed
  },
];

// ---------------------------------------------------------------------------
// Global config templates
// ---------------------------------------------------------------------------

const CLAUDE_MD_BLOCK_MARKER = "# Knowledge Base (goodai-base)";

function CLAUDE_MD_BLOCK(goodaiPath: string): string {
  return `
# Knowledge Base (goodai-base)

At the start of each session, read \`${goodaiPath}/AGENTS.md\` — it contains the routing table for all coding rules and skills (analysis, implementation, review, orchestration). Do NOT read all files upfront. Use AGENTS.md to locate the right rule or skill when the user's request matches, then read only that specific file.

- Rules are in \`${goodaiPath}/rules/core/\` — coding standards, git rules, review profiles
- Skills are in \`${goodaiPath}/skills/\` — actionable workflows (feature-analyzer, issue-analyzer, task-implementer, reviewers, etc.)
- When the user asks to analyze, implement, review, or orchestrate — consult AGENTS.md first

### Skill/Rule workflow for non-trivial tasks

For any task more complex than a simple answer or one-liner fix:
1. Read \`${goodaiPath}/AGENTS.md\` and identify matching skills or rules
2. Tell the user which skill or rule applies and briefly describe what it will do
3. **Wait for the user to confirm** before proceeding
4. Only when the user says "run it", "запускай", or similar — invoke the skill via \`Skill("skill-name")\` tool
5. NEVER manually read a SKILL.md and apply its pattern yourself — always use the \`Skill\` tool
`;
}

function CURSOR_MDC_BLOCK(goodaiPath: string): string {
  return `---
description: "goodai-base routing — always loaded. Maps user intent to skills and rules."
alwaysApply: true
---

# goodai-base Knowledge Base

At the start of each session, read \`${goodaiPath}/AGENTS.md\` — it contains the routing table for all coding rules and skills.

- Rules: \`${goodaiPath}/rules/core/\` — coding standards, git conventions, review profiles
- Skills: \`${goodaiPath}/skills/\` — feature-analyzer, issue-analyzer, task-implementer, reviewers, etc.

When the user asks to analyze, implement, review, or orchestrate — consult AGENTS.md first to identify the right skill or rule, then read only that file.

**Skill invocation:** For non-trivial tasks, identify the matching skill from AGENTS.md, describe it to the user, wait for confirmation, then execute it. Never manually follow a skill's steps — use the skill as a unit of work.
`;
}

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

function ask(question: string, defaultValue = ""): string {
  const suffix = defaultValue ? ` ${c.dim(`[${defaultValue}]`)}` : "";
  process.stdout.write(`  ${question}${suffix}: `);
  const answer = prompt("")?.trim() ?? "";
  return answer || defaultValue;
}

function askYN(question: string, defaultYes = true): boolean {
  const hint = defaultYes ? "Y/n" : "y/N";
  process.stdout.write(`  ${question} ${c.dim(`(${hint})`)}: `);
  const answer = prompt("")?.trim().toLowerCase() ?? "";
  if (answer === "") return defaultYes;
  return answer === "y" || answer === "yes";
}

function askChoice(question: string, options: string[], defaultIdx = 0): number {
  console.log(`\n  ${c.bold(question)}`);
  options.forEach((opt, i) => {
    const marker = i === defaultIdx ? c.cyan("►") : " ";
    console.log(`  ${marker} ${c.cyan(`${i + 1}.`)} ${opt}`);
  });
  const answer = ask("Choice", String(defaultIdx + 1));
  const idx = parseInt(answer) - 1;
  return idx >= 0 && idx < options.length ? idx : defaultIdx;
}

/**
 * Multi-select: show numbered list, user types comma-separated numbers or "all"/"none".
 * Returns array of selected indices.
 */
function askMultiSelect(question: string, options: string[], defaultSelected: number[]): number[] {
  const defaultStr = defaultSelected.map((i) => i + 1).join(",");
  console.log(`\n  ${c.bold(question)}`);
  console.log(c.dim("  Enter comma-separated numbers, 'all', or 'none'"));
  options.forEach((opt, i) => {
    const selected = defaultSelected.includes(i) ? c.green("✓") : " ";
    console.log(`  ${selected} ${c.cyan(`${i + 1}.`)} ${opt}`);
  });
  const answer = ask("Selection", defaultStr);
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === "all") return options.map((_, i) => i);
  if (trimmed === "none") return [];
  return trimmed
    .split(",")
    .map((s) => parseInt(s.trim()) - 1)
    .filter((i) => i >= 0 && i < options.length);
}

function section(title: string) {
  console.log(`\n${c.bold("─".repeat(50))}`);
  console.log(`${c.bold(title)}`);
  console.log(`${"─".repeat(50)}\n`);
}

function step(msg: string) {
  process.stdout.write(`  ${msg}...`);
}

function ok() {
  console.log(` ${c.green("✓")}`);
}

function warn(msg: string) {
  console.log(`  ${c.yellow("⚠")} ${msg}`);
}

// ---------------------------------------------------------------------------
// Shell rc helpers
// ---------------------------------------------------------------------------

function detectShellRc(): string | null {
  if (existsSync(`${HOME}/.zshrc`)) return `${HOME}/.zshrc`;
  if (existsSync(`${HOME}/.bashrc`)) return `${HOME}/.bashrc`;
  if (existsSync(`${HOME}/.bash_profile`)) return `${HOME}/.bash_profile`;
  return null;
}

function envLineAlreadySet(rcPath: string, varName: string): boolean {
  if (!existsSync(rcPath)) return false;
  return readFileSync(rcPath, "utf8").includes(`${varName}=`);
}

function appendEnvVar(rcPath: string, varName: string, value: string) {
  if (!envLineAlreadySet(rcPath, varName)) {
    appendFileSync(rcPath, `\nexport ${varName}="${value}"\n`);
  }
}

// ---------------------------------------------------------------------------
// Global config injection per tool
// ---------------------------------------------------------------------------

function updateClaudeMd(goodaiPath: string): string {
  const claudeDir = join(HOME, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  const block = CLAUDE_MD_BLOCK(goodaiPath);

  if (!existsSync(CONFIG_PATH.replace("goodai.config.json", ".claude/CLAUDE.md"))) {
    // resolve actual path
  }
  const claudeMdPath = join(HOME, ".claude", "CLAUDE.md");

  if (!existsSync(claudeMdPath)) {
    writeFileSync(claudeMdPath, `# Global CLAUDE.md\n${block}`);
    return "created";
  }
  const content = readFileSync(claudeMdPath, "utf8");
  if (content.includes(CLAUDE_MD_BLOCK_MARKER)) {
    const idx = content.indexOf(CLAUDE_MD_BLOCK_MARKER);
    const after = content.slice(idx + CLAUDE_MD_BLOCK_MARKER.length);
    const nextHeading = after.search(/\n# [^#]/);
    const tail = nextHeading >= 0 ? after.slice(nextHeading) : "";
    writeFileSync(claudeMdPath, content.slice(0, idx) + block.trimStart() + tail);
    return "updated";
  }
  appendFileSync(claudeMdPath, block);
  return "appended";
}

function writeCursorMdc(goodaiPath: string): string {
  const rulesDir = join(HOME, ".cursor", "rules");
  mkdirSync(rulesDir, { recursive: true });
  const mdcPath = join(rulesDir, "goodai-base.mdc");
  const content = CURSOR_MDC_BLOCK(goodaiPath);
  writeFileSync(mdcPath, content);
  return existsSync(mdcPath) ? "updated" : "created";
}

function configureGlobalConfig(tool: ToolDef, goodaiPath: string): void {
  if (!tool.globalConfigPath || !tool.globalConfigContent) return;

  if (tool.id === "claude") {
    step(`Updating ${tool.globalConfigLabel}`);
    const result = updateClaudeMd(goodaiPath);
    console.log(` ${c.green(result)}`);
    return;
  }

  if (tool.id === "cursor") {
    step(`Writing ${tool.globalConfigLabel}`);
    writeCursorMdc(goodaiPath);
    ok();
    return;
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface GoodAIConfig {
  goodai_base: string;
  sync_tools: string[];
  jobs_root?: string;
  docs_root?: string;
  default_model: string;
  tdd_mode: "strict" | "relaxed";
  docs_languages: "ru+en+ai" | "en+ai" | "en";
  auto_sync_agents: boolean;
}

function loadConfig(): Partial<GoodAIConfig> {
  if (existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveConfig(cfg: GoodAIConfig) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

async function setup() {
  const existing = loadConfig();

  console.log(`\n${c.bold("goodai-base Setup Wizard")}`);
  console.log(c.dim(`Repo: ${GOODAI_BASE}\n`));

  // ── 1. AI Tools to sync ────────────────────────────────────────────────

  section("1 / 6  AI tools to sync");

  console.log(c.dim(
    "  Skills and AGENTS.md routing table will be synced to the selected tools.\n" +
    "  You can reconfigure this at any time with: bun setup.ts --reconfigure\n"
  ));

  const toolLabels = TOOLS.map((t) => {
    const installed = existsSync(t.skillsDir) || existsSync(join(t.skillsDir, ".."));
    const hint = installed ? c.dim(" (detected)") : "";
    return `${t.label}${hint}`;
  });

  const existingToolIds = existing.sync_tools ?? ["claude"];
  const defaultToolIndices = TOOLS.map((t, i) => existingToolIds.includes(t.id) ? i : -1).filter(i => i >= 0);

  const selectedToolIndices = askMultiSelect("Which AI tools to sync:", toolLabels, defaultToolIndices);
  const selectedTools = selectedToolIndices.map((i) => TOOLS[i]!);
  const syncToolIds = selectedTools.map((t) => t.id);

  // ── 2. Global config per tool ──────────────────────────────────────────

  section("2 / 6  Global config per tool");

  console.log(c.dim(
    "  For each tool, you can inject a global instructions block so the AI\n" +
    "  automatically knows to use goodai-base skills and rules every session.\n"
  ));

  const toolsWithGlobalConfig = selectedTools.filter((t) => t.globalConfigPath && t.globalConfigContent);
  const configureGlobalTools: ToolDef[] = [];

  if (toolsWithGlobalConfig.length === 0) {
    console.log(c.dim("  (no selected tools support global config injection)\n"));
  } else {
    for (const tool of toolsWithGlobalConfig) {
      const alreadySet = tool.globalConfigPath
        ? (existsSync(tool.globalConfigPath) &&
           readFileSync(tool.globalConfigPath, "utf8").includes("goodai-base"))
        : false;
      const question = alreadySet
        ? `Update ${tool.globalConfigLabel}? (goodai-base block detected)`
        : `Add goodai-base block to ${tool.globalConfigLabel}?`;
      if (askYN(question, !alreadySet)) {
        configureGlobalTools.push(tool);
      }
    }
  }

  // ── 3. Artifact paths ──────────────────────────────────────────────────

  section("3 / 6  Artifact paths");

  console.log(c.dim(
    "  By default, jobs and docs are written to <PROJECT_DIR>/jobs/ and <PROJECT_DIR>/docs/.\n" +
    "  Override globally with env vars (useful for shared/centralised storage).\n"
  ));

  const customizeArtifacts = askYN("Customize artifact paths?", false);
  let jobsRoot = "";
  let docsRoot = "";

  if (customizeArtifacts) {
    jobsRoot = ask("GOODAI_JOBS_ROOT (leave empty = PROJECT_DIR/jobs)", existing.jobs_root ?? "");
    docsRoot = ask("GOODAI_DOCS_ROOT (leave empty = PROJECT_DIR/docs)", existing.docs_root ?? "");
  } else {
    jobsRoot = existing.jobs_root ?? "";
    docsRoot = existing.docs_root ?? "";
  }

  // ── 4. Default model ───────────────────────────────────────────────────

  section("4 / 6  Default sub-agent model");

  console.log(c.dim(
    "  Used by task-implementer, tests-creator, code-verifier, and other sub-agents\n" +
    "  dispatched during pipeline execution.\n"
  ));

  const modelOptions = [
    "claude-sonnet-4-6  (recommended — best balance of speed and quality)",
    "claude-opus-4-6    (highest quality, slower and more expensive)",
    "claude-haiku-4-5   (fastest and cheapest, good for simple tasks)",
  ];
  const modelValues = ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"];
  const currentModelIdx = modelValues.indexOf(existing.default_model ?? "claude-sonnet-4-6");
  const modelIdx = askChoice("Model for sub-agents:", modelOptions, Math.max(0, currentModelIdx));
  const defaultModel = modelValues[modelIdx]!;

  // ── 5. TDD enforcement ─────────────────────────────────────────────────

  section("5 / 6  TDD enforcement");

  console.log(c.dim(
    "  Strict: tests-creator MUST run before every task-implementer wave, no exceptions.\n" +
    "  Relaxed: skippable for fix tasks and minor changes.\n"
  ));

  const tddOptions = [
    "Strict  — Iron Laws always enforced (recommended for production projects)",
    "Relaxed — tests-creator skippable for fix/hotfix tasks",
  ];
  const tddValues: GoodAIConfig["tdd_mode"][] = ["strict", "relaxed"];
  const currentTddIdx = tddValues.indexOf((existing.tdd_mode ?? "strict") as GoodAIConfig["tdd_mode"]);
  const tddIdx = askChoice("TDD enforcement:", tddOptions, Math.max(0, currentTddIdx));
  const tddMode = tddValues[tddIdx]!;

  // ── 6. Post-install actions ────────────────────────────────────────────

  section("6 / 6  Post-install actions");

  console.log(c.dim(
    "  Documentation languages control which variants are generated by feature-analyzer,\n" +
    "  requirements-management, and implementation-plans.\n"
  ));

  const langOptions = [
    "ru + en + ai  — full trilingual output (recommended for Russian-speaking teams)",
    "en + ai       — English + AI-optimized variant",
    "en only       — single English output",
  ];
  const langValues: GoodAIConfig["docs_languages"][] = ["ru+en+ai", "en+ai", "en"];
  const currentLangIdx = langValues.indexOf((existing.docs_languages ?? "ru+en+ai") as GoodAIConfig["docs_languages"]);
  const langIdx = askChoice("Documentation languages:", langOptions, Math.max(0, currentLangIdx));
  const docsLanguages = langValues[langIdx]!;

  console.log();
  const syncNow = askYN(
    `Sync skills to selected tools now? (${selectedTools.map(t => t.label).join(", ")})`,
    true
  );

  console.log();
  const configureEnv = askYN("Write env vars to shell rc file?", true);

  console.log();
  const deployHook = askYN("Deploy skill-evaluator hook to a project now?", false);
  let hookTarget = "";
  if (deployHook) {
    hookTarget = ask("Project path");
    if (!existsSync(hookTarget)) {
      warn(`Path not found: ${hookTarget} — skipping hook deploy`);
      hookTarget = "";
    }
  }

  // ── Apply ──────────────────────────────────────────────────────────────

  console.log(`\n${c.bold("─".repeat(50))}`);
  console.log(`${c.bold("Applying settings...")}`);
  console.log(`${"─".repeat(50)}\n`);

  // Save config
  step("Saving goodai.config.json");
  const cfg: GoodAIConfig = {
    goodai_base: GOODAI_BASE,
    sync_tools: syncToolIds,
    default_model: defaultModel,
    tdd_mode: tddMode,
    docs_languages: docsLanguages,
    auto_sync_agents: syncNow,
    ...(jobsRoot ? { jobs_root: jobsRoot } : {}),
    ...(docsRoot ? { docs_root: docsRoot } : {}),
  };
  saveConfig(cfg);
  ok();

  // Shell env vars
  if (configureEnv) {
    const rcPath = detectShellRc();
    if (rcPath) {
      step(`Writing env vars to ${rcPath.replace(HOME, "~")}`);
      appendEnvVar(rcPath, "GOODAI_BASE", GOODAI_BASE);
      if (jobsRoot) appendEnvVar(rcPath, "GOODAI_JOBS_ROOT", jobsRoot);
      if (docsRoot) appendEnvVar(rcPath, "GOODAI_DOCS_ROOT", docsRoot);
      appendEnvVar(rcPath, "GOODAI_DEFAULT_MODEL", defaultModel);
      ok();
    } else {
      warn("No shell rc file found — set env vars manually");
    }
  }

  // Global configs
  for (const tool of configureGlobalTools) {
    configureGlobalConfig(tool, GOODAI_BASE);
  }

  // Sync skills to selected tools
  if (syncNow) {
    step(`Syncing skills to: ${selectedTools.map((t) => t.label).join(", ")}`);
    const toolsArg = syncToolIds.join(",");
    const proc = spawnSync(
      "bun",
      ["src/sync-skills.ts", "--tools", toolsArg],
      { cwd: join(GOODAI_BASE, "scripts"), stdio: ["inherit", "pipe", "pipe"], encoding: "utf8" }
    );
    proc.status === 0 ? ok() : warn(`sync-skills failed:\n${proc.stderr?.trim()}`);

    // Sync native Claude agents if claude is selected
    if (syncToolIds.includes("claude")) {
      step("Syncing Claude native agents");
      const agentProc = spawnSync(
        "bun",
        ["src/sync-agents.ts"],
        { cwd: join(GOODAI_BASE, "scripts"), stdio: ["inherit", "pipe", "pipe"], encoding: "utf8" }
      );
      agentProc.status === 0 ? ok() : warn(`sync-agents failed: ${agentProc.stderr?.trim()}`);
    }
  }

  // Deploy hook
  if (hookTarget) {
    step(`Deploying skill-evaluator hook to ${hookTarget}`);
    const proc = spawnSync(
      "bun",
      ["src/deploy-skill-hook.ts", hookTarget],
      { cwd: join(GOODAI_BASE, "scripts"), stdio: ["inherit", "pipe", "pipe"], encoding: "utf8" }
    );
    proc.status === 0 ? ok() : warn(`hook deploy failed: ${proc.stderr?.trim()}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────

  console.log(`\n${c.green(c.bold("Setup complete!"))}\n`);
  console.log(`  ${c.bold("Config:")}      ${CONFIG_PATH}`);
  console.log(`  ${c.bold("Tools:")}       ${selectedTools.map((t) => t.label).join(", ")}`);
  console.log(`  ${c.bold("Model:")}       ${defaultModel}`);
  console.log(`  ${c.bold("TDD mode:")}    ${tddMode}`);
  console.log(`  ${c.bold("Languages:")}   ${docsLanguages}`);
  if (jobsRoot) console.log(`  ${c.bold("JOBS_ROOT:")}   ${jobsRoot}`);
  if (docsRoot) console.log(`  ${c.bold("DOCS_ROOT:")}   ${docsRoot}`);

  console.log(`\n  ${c.dim("Re-run at any time:")} ${c.cyan("bun setup.ts --reconfigure")}`);
  console.log(`  ${c.dim("Sync only:")}           ${c.cyan(`cd ${GOODAI_BASE}/scripts && bun run sync-skills --tools ${syncToolIds.join(",")}`)}\n`);

  if (configureEnv) {
    console.log(c.dim("  Restart your shell (or run 'source ~/.zshrc') to apply env vars.\n"));
  }
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

await setup();
