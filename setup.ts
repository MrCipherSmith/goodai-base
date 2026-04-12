#!/usr/bin/env bun
/**
 * goodai-base Setup Wizard
 *
 * Usage:
 *   bun setup.ts          Run the interactive setup wizard
 *   bun setup.ts --reconfigure   Re-run wizard over an existing install
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
// Prompt helpers (synchronous via `prompt()` — available in Bun)
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
  const answer = ask(`Choice`, String(defaultIdx + 1));
  const idx = parseInt(answer) - 1;
  return idx >= 0 && idx < options.length ? idx : defaultIdx;
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
// CLAUDE.md helpers
// ---------------------------------------------------------------------------

const CLAUDE_MD_DIR = join(HOME, ".claude");
const CLAUDE_MD_PATH = join(CLAUDE_MD_DIR, "CLAUDE.md");

const GOODAI_BLOCK_START = "# Knowledge Base (goodai-base)";
const GOODAI_BLOCK = (goodaiPath: string) => `
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

function claudeMdHasBlock(): boolean {
  if (!existsSync(CLAUDE_MD_PATH)) return false;
  return readFileSync(CLAUDE_MD_PATH, "utf8").includes(GOODAI_BLOCK_START);
}

function updateClaudeMd(goodaiPath: string) {
  mkdirSync(CLAUDE_MD_DIR, { recursive: true });
  const block = GOODAI_BLOCK(goodaiPath);
  if (!existsSync(CLAUDE_MD_PATH)) {
    writeFileSync(CLAUDE_MD_PATH, `# Global CLAUDE.md\n${block}`);
    return "created";
  }
  const content = readFileSync(CLAUDE_MD_PATH, "utf8");
  if (content.includes(GOODAI_BLOCK_START)) {
    // Replace existing block: find start marker and strip old block
    const idx = content.indexOf(GOODAI_BLOCK_START);
    // Find next top-level `#` heading after the block (or end of file)
    const after = content.slice(idx + GOODAI_BLOCK_START.length);
    const nextHeading = after.search(/\n# [^#]/);
    const tail = nextHeading >= 0 ? after.slice(nextHeading) : "";
    const updated = content.slice(0, idx) + block.trimStart() + tail;
    writeFileSync(CLAUDE_MD_PATH, updated);
    return "updated";
  }
  appendFileSync(CLAUDE_MD_PATH, block);
  return "appended";
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface GoodAIConfig {
  goodai_base: string;
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

  // ── 1. Artifact paths ──────────────────────────────────────────────────

  section("1 / 5  Artifact paths");

  console.log(c.dim(
    "  By default, jobs and docs are written to <PROJECT_DIR>/jobs/ and <PROJECT_DIR>/docs/.\n" +
    "  You can override these globally with env vars (useful for shared/centralised storage).\n"
  ));

  const customizeArtifacts = askYN("Customize artifact paths?", false);
  let jobsRoot = "";
  let docsRoot = "";

  if (customizeArtifacts) {
    jobsRoot = ask(
      "GOODAI_JOBS_ROOT (leave empty = PROJECT_DIR/jobs)",
      existing.jobs_root ?? ""
    );
    docsRoot = ask(
      "GOODAI_DOCS_ROOT (leave empty = PROJECT_DIR/docs)",
      existing.docs_root ?? ""
    );
  } else {
    jobsRoot = existing.jobs_root ?? "";
    docsRoot = existing.docs_root ?? "";
  }

  // ── 2. Default model ───────────────────────────────────────────────────

  section("2 / 5  Default sub-agent model");

  console.log(c.dim(
    "  This model is used by task-implementer, tests-creator, code-verifier, and other\n" +
    "  sub-agents dispatched during pipeline execution.\n"
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

  // ── 3. TDD enforcement ─────────────────────────────────────────────────

  section("3 / 5  TDD enforcement");

  console.log(c.dim(
    "  Strict mode: tests-creator MUST run before every task-implementer wave.\n" +
    "  No exceptions — even if user says 'skip tests'.\n\n" +
    "  Relaxed mode: tests-creator can be skipped for fix tasks and minor changes.\n" +
    "  Still mandatory for new features and service_api tasks.\n"
  ));

  const tddOptions = [
    "Strict  — Iron Laws always enforced (recommended for production projects)",
    "Relaxed — tests-creator skippable for fix/hotfix tasks",
  ];
  const tddValues: GoodAIConfig["tdd_mode"][] = ["strict", "relaxed"];
  const currentTddIdx = tddValues.indexOf((existing.tdd_mode ?? "strict") as GoodAIConfig["tdd_mode"]);
  const tddIdx = askChoice("TDD enforcement:", tddOptions, Math.max(0, currentTddIdx));
  const tddMode = tddValues[tddIdx]!;

  // ── 4. Documentation languages ─────────────────────────────────────────

  section("4 / 5  Documentation languages");

  console.log(c.dim(
    "  Controls which language variants are generated by feature-analyzer,\n" +
    "  requirements-management, and implementation-plans skills.\n"
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

  // ── 5. Post-install actions ────────────────────────────────────────────

  section("5 / 5  Post-install actions");

  const syncAgents = askYN(
    "Run sync-agents now? (generates .claude/agents/ files for native sub-agents)",
    true
  );

  console.log();
  const configureClaudeMd = claudeMdHasBlock()
    ? askYN(`Update ~/.claude/CLAUDE.md with goodai-base reference?`, false)
    : askYN(`Add goodai-base reference to ~/.claude/CLAUDE.md?`, true);

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
    default_model: defaultModel,
    tdd_mode: tddMode,
    docs_languages: docsLanguages,
    auto_sync_agents: syncAgents,
    ...(jobsRoot ? { jobs_root: jobsRoot } : {}),
    ...(docsRoot ? { docs_root: docsRoot } : {}),
  };
  saveConfig(cfg);
  ok();

  // Shell env vars
  if (configureEnv) {
    const rcPath = detectShellRc();
    if (rcPath) {
      step(`Writing env vars to ${rcPath}`);
      appendEnvVar(rcPath, "GOODAI_BASE", GOODAI_BASE);
      if (jobsRoot) appendEnvVar(rcPath, "GOODAI_JOBS_ROOT", jobsRoot);
      if (docsRoot) appendEnvVar(rcPath, "GOODAI_DOCS_ROOT", docsRoot);
      appendEnvVar(rcPath, "GOODAI_DEFAULT_MODEL", defaultModel);
      ok();
    } else {
      warn("No shell rc file found — set env vars manually");
    }
  }

  // CLAUDE.md
  if (configureClaudeMd) {
    step("Updating ~/.claude/CLAUDE.md");
    const result = updateClaudeMd(GOODAI_BASE);
    console.log(` ${c.green(result)}`);
  }

  // Sync agents
  if (syncAgents) {
    step("Running sync-agents");
    const proc = spawnSync("bun", ["run", "sync-agents"], {
      cwd: join(GOODAI_BASE, "scripts"),
      stdio: ["inherit", "pipe", "pipe"],
      encoding: "utf8",
    });
    proc.status === 0 ? ok() : warn(`sync-agents failed: ${proc.stderr?.trim()}`);
  }

  // Deploy hook
  if (hookTarget) {
    step(`Deploying skill-evaluator hook to ${hookTarget}`);
    const proc = spawnSync("bun", ["src/deploy-skill-hook.ts", hookTarget], {
      cwd: join(GOODAI_BASE, "scripts"),
      stdio: ["inherit", "pipe", "pipe"],
      encoding: "utf8",
    });
    proc.status === 0 ? ok() : warn(`hook deploy failed: ${proc.stderr?.trim()}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────

  console.log(`\n${c.green(c.bold("Setup complete!"))}\n`);
  console.log(`  ${c.bold("Config:")}      ${CONFIG_PATH}`);
  console.log(`  ${c.bold("Model:")}       ${defaultModel}`);
  console.log(`  ${c.bold("TDD mode:")}    ${tddMode}`);
  console.log(`  ${c.bold("Languages:")}   ${docsLanguages}`);
  if (jobsRoot) console.log(`  ${c.bold("JOBS_ROOT:")}   ${jobsRoot}`);
  if (docsRoot) console.log(`  ${c.bold("DOCS_ROOT:")}   ${docsRoot}`);

  console.log(`\n  ${c.dim("Re-run at any time:")} ${c.cyan("bun setup.ts --reconfigure")}\n`);

  if (configureEnv) {
    console.log(c.dim("  Restart your shell (or run 'source ~/.zshrc') to apply env vars.\n"));
  }
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

await setup();
