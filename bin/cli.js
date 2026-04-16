#!/usr/bin/env node
/**
 * goodai-base CLI
 * Installs and syncs AI agent skills to Claude Code, Cursor, Codex, Zed, OpenCode.
 *
 * Usage:
 *   npx goodai-base install            # install to all detected tools
 *   npx goodai-base install --tools claude,cursor
 *   npx goodai-base sync               # re-sync skills (update to latest)
 *   npx goodai-base status             # show install status
 */

import fs from "fs";
import path from "path";
import os from "os";

const HOME = os.homedir();
const PACKAGE_DIR = path.resolve(import.meta.dirname, "..");
const VERSION = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf8")).version;

const MARKER = "# Knowledge Base (goodai-base)";
const MARKER_END = "# END goodai-base";

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = {
  claude: {
    label: "Claude Code",
    skillsDir: path.join(HOME, ".claude", "skills"),
    globalConfigPath: path.join(HOME, ".claude", "CLAUDE.md"),
    globalConfigContent: (pkgPath) => claudeMdBlock(pkgPath),
    agentsFile: null,
  },
  cursor: {
    label: "Cursor",
    skillsDir: path.join(HOME, ".cursor", "skills"),
    globalConfigPath: path.join(HOME, ".cursor", "rules", "goodai-base.mdc"),
    globalConfigContent: (pkgPath) => cursorMdcBlock(pkgPath),
    agentsFile: path.join(HOME, ".cursor", "rules", "AGENTS.md"),
  },
  codex: {
    label: "Codex",
    skillsDir: path.join(HOME, ".codex", "skills"),
    globalConfigPath: null,
    globalConfigContent: null,
    agentsFile: path.join(HOME, ".codex", "AGENTS.md"),
  },
  opencode: {
    label: "OpenCode",
    skillsDir: path.join(HOME, ".config", "opencode", "skills"),
    globalConfigPath: null,
    globalConfigContent: null,
    agentsFile: path.join(HOME, ".config", "opencode", "AGENTS.md"),
  },
  zed: {
    label: "Zed",
    skillsDir: path.join(HOME, ".config", "zed", "skills"),
    globalConfigPath: null,
    globalConfigContent: null,
    agentsFile: path.join(HOME, ".config", "zed", "AGENTS.md"),
  },
};

// ─── Block templates ──────────────────────────────────────────────────────────

function claudeMdBlock(pkgPath) {
  return `
${MARKER}

At the start of each session, read \`${pkgPath}/AGENTS.md\` — it contains the routing table for all coding rules and skills (analysis, implementation, review, orchestration). Do NOT read all files upfront. Use AGENTS.md to locate the right rule or skill when the user's request matches, then read only that specific file.

- Rules are in \`${pkgPath}/rules/core/\` — coding standards, git rules, review profiles
- Skills are in \`${pkgPath}/skills/\` — actionable workflows (feature-analyzer, issue-analyzer, task-implementer, reviewers, etc.)
- When the user asks to analyze, implement, review, or orchestrate — consult AGENTS.md first

### Skill/Rule workflow for non-trivial tasks

For any task more complex than a simple answer or one-liner fix:
1. Read \`${pkgPath}/AGENTS.md\` and identify matching skills or rules
2. Tell the user which skill or rule applies and briefly describe what it will do
3. **Wait for the user to confirm** before proceeding
4. Only when the user says "run it", "запускай", or similar — invoke the skill via \`Skill("skill-name")\` tool
5. NEVER manually read a SKILL.md and apply its pattern yourself — always use the \`Skill\` tool

${MARKER_END}
`;
}

function cursorMdcBlock(pkgPath) {
  return `---
description: "goodai-base routing — always loaded. Maps user intent to skills and rules."
alwaysApply: true
---

${MARKER}

At the start of each session, read \`${pkgPath}/AGENTS.md\` — it contains the routing table for all coding rules and skills.

- Rules: \`${pkgPath}/rules/core/\` — coding standards, git conventions, review profiles
- Skills: \`${pkgPath}/skills/\` — feature-analyzer, issue-analyzer, task-implementer, reviewers, etc.

When the user asks to analyze, implement, review, or orchestrate — consult AGENTS.md first, then load only the matching skill or rule file.

${MARKER_END}
`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function injectBlock(filePath, content) {
  ensureDir(path.dirname(filePath));
  let existing = "";
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, "utf8");
  }

  // Remove existing block if present
  const startIdx = existing.indexOf(MARKER);
  const endIdx = existing.indexOf(MARKER_END);
  if (startIdx !== -1 && endIdx !== -1) {
    existing = existing.slice(0, startIdx).trimEnd() + "\n" + existing.slice(endIdx + MARKER_END.length).trimStart();
  } else if (startIdx !== -1) {
    existing = existing.slice(0, startIdx).trimEnd() + "\n";
  }

  fs.writeFileSync(filePath, existing.trimEnd() + "\n\n" + content.trimStart(), "utf8");
}

function toolIsDetected(toolId) {
  const tool = TOOLS[toolId];
  switch (toolId) {
    case "claude": return fs.existsSync(path.join(HOME, ".claude"));
    case "cursor": return fs.existsSync(path.join(HOME, ".cursor"));
    case "codex": return fs.existsSync(path.join(HOME, ".codex"));
    case "opencode": return fs.existsSync(path.join(HOME, ".config", "opencode"));
    case "zed": return fs.existsSync(path.join(HOME, ".config", "zed"));
    default: return false;
  }
}

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }
function skip(msg) { console.log(`  – ${msg}`); }

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdInstall(toolIds) {
  log(`\ngoodai-base v${VERSION} — installing\n`);

  const skillsSrc = path.join(PACKAGE_DIR, "skills");
  const agentsSrc = path.join(PACKAGE_DIR, "AGENTS.md");

  for (const id of toolIds) {
    const tool = TOOLS[id];
    if (!tool) {
      warn(`Unknown tool: ${id} — skipping`);
      continue;
    }

    log(`[${tool.label}]`);

    // 1. Copy skills
    if (fs.existsSync(skillsSrc)) {
      copyDir(skillsSrc, tool.skillsDir);
      ok(`Skills → ${tool.skillsDir}`);
    }

    // 2. Copy AGENTS.md (for tools that use it)
    if (tool.agentsFile) {
      ensureDir(path.dirname(tool.agentsFile));
      fs.copyFileSync(agentsSrc, tool.agentsFile);
      ok(`AGENTS.md → ${tool.agentsFile}`);
    }

    // 3. Inject global config block
    if (tool.globalConfigPath && tool.globalConfigContent) {
      injectBlock(tool.globalConfigPath, tool.globalConfigContent(PACKAGE_DIR));
      ok(`Routing block → ${tool.globalConfigPath}`);
    }

    log("");
  }

  log("Done. Restart your AI tool to apply changes.\n");
}

function cmdSync(toolIds) {
  log(`\ngoodai-base v${VERSION} — syncing skills\n`);

  const skillsSrc = path.join(PACKAGE_DIR, "skills");
  const agentsSrc = path.join(PACKAGE_DIR, "AGENTS.md");

  for (const id of toolIds) {
    const tool = TOOLS[id];
    if (!tool) continue;

    log(`[${tool.label}]`);

    if (fs.existsSync(skillsSrc)) {
      copyDir(skillsSrc, tool.skillsDir);
      ok(`Skills synced → ${tool.skillsDir}`);
    }

    if (tool.agentsFile && fs.existsSync(agentsSrc)) {
      fs.copyFileSync(agentsSrc, tool.agentsFile);
      ok(`AGENTS.md synced`);
    }

    log("");
  }

  log("Sync complete.\n");
}

function cmdStatus() {
  log(`\ngoodai-base v${VERSION} — install status\n`);

  for (const [id, tool] of Object.entries(TOOLS)) {
    const detected = toolIsDetected(id);
    const skillsInstalled = fs.existsSync(tool.skillsDir);
    const icon = skillsInstalled ? "✓" : detected ? "○" : "–";
    const detail = skillsInstalled
      ? `skills at ${tool.skillsDir}`
      : detected
      ? `tool detected but skills not installed`
      : `tool not found`;
    log(`  ${icon} ${tool.label.padEnd(14)} ${detail}`);
  }

  log(`\nPackage location: ${PACKAGE_DIR}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0] ?? "install";
const toolsArg = args.find(a => a.startsWith("--tools="))?.slice("--tools=".length)
  ?? args[args.indexOf("--tools") + 1];

let selectedTools;

if (toolsArg) {
  selectedTools = toolsArg.split(",").map(t => t.trim());
} else if (command === "install") {
  // Auto-detect installed tools
  selectedTools = Object.keys(TOOLS).filter(toolIsDetected);
  if (selectedTools.length === 0) {
    selectedTools = ["claude"]; // fallback to Claude Code
  }
  log(`Auto-detected tools: ${selectedTools.join(", ")}`);
} else {
  selectedTools = Object.keys(TOOLS).filter(toolIsDetected);
}

switch (command) {
  case "install":
    cmdInstall(selectedTools);
    break;
  case "sync":
    cmdSync(selectedTools);
    break;
  case "status":
    cmdStatus();
    break;
  case "--version":
  case "-v":
    console.log(VERSION);
    break;
  default:
    console.log(`
goodai-base v${VERSION}

Usage:
  npx goodai-base install                      Install to all detected tools
  npx goodai-base install --tools claude,cursor  Install to specific tools
  npx goodai-base sync                         Re-sync skills (after update)
  npx goodai-base status                       Show install status

Tools: claude, cursor, codex, opencode, zed
`);
}
