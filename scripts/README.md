# Scripts

TypeScript utilities for goodai-base, running on [Bun](https://bun.sh).

## Setup

```bash
cd scripts && bun install
```

## Scripts

| Script | Description |
|---|---|
| `sync-skills` | Sync `SKILL.<platform>.md` files to all agent directories |
| `sync-agents` | Regenerate stale Claude Code native agent files (checksum-based) |
| `generate-skill-catalog` | Regenerate `docs/skill-catalog.md` and `docs/ai/skill-catalog.yaml` |
| `generate-rules-catalog` | Regenerate `docs/rules-catalog.md` |
| `generate-skill-registry` | Regenerate `hooks/skill-registry.json` from skills frontmatter |
| `generate-rules-json` | Regenerate `rules.json` from AGENTS.md |
| `generate-agents` | Generate `~/.claude/agents/<name>.md` from agent-worthy skills |
| `validate-rules-json` | Validate `rules.json` against AGENTS.md |
| `validate-skills-before-sync` | Pre-sync gate: checks required platform variants and frontmatter |
| `detect-context` | Detect matching rules/skills for stdin text input |
| `detect-models` | Detect AI tool configs present on this machine |
| `deploy-skill-hook` | Deploy skill evaluator hook into a target project |

## Usage

```bash
# Validate and sync skills to configured tools (reads goodai.config.json)
cd scripts && bun run sync-skills

# Sync to specific tools only
cd scripts && bun src/sync-skills.ts --tools claude,cursor

# Force sync to all known tools regardless of config
cd scripts && bun src/sync-skills.ts --all

# Regenerate documentation catalogs
cd scripts && bun run generate-skill-catalog
cd scripts && bun run generate-rules-catalog

# Generate native Claude Code agents from agent-worthy skills
cd scripts && bun run generate-agents

# Deploy hook to a project
cd scripts && bun run deploy-skill-hook /path/to/your/project
```

## Canonical schema

`~/goodai-base/rules/schemas/skill-workflow-result.schema.json` — orchestrator contract for skill workflow results (status, decision, errors, artifacts, timestamp).

## Sync targets

`sync-skills` syncs to tools selected during setup (`goodai.config.json: sync_tools`). Override with `--tools` or `--all`.

| Tool | Skills dir | AGENTS.md | Commands |
|------|-----------|-----------|----------|
| Claude Code | `~/.claude/skills/` | via CLAUDE.md | `~/.claude/commands/` |
| Cursor | `~/.cursor/skills/` | `~/.cursor/rules/AGENTS.md` | — |
| Codex | `~/.codex/skills/` | `~/.codex/AGENTS.md` | — |
| OpenCode | `~/.config/opencode/skills/` | `~/.config/opencode/AGENTS.md` | — |
| Zed | `~/.config/zed/skills/` | `~/.config/zed/AGENTS.md` | — |
| Antigravity | `~/.antigravity/skills/` | — | — |

**Global config** (injected by setup wizard, not by sync-skills):
- Claude Code: `~/.claude/CLAUDE.md` — goodai-base routing block
- Cursor: `~/.cursor/rules/goodai-base.mdc` — `alwaysApply: true` routing rule

## Shared modules (`src/shared/`)

| Module | Exports |
|---|---|
| `frontmatter.ts` | `parseSkillFrontmatter`, `parseRuleFrontmatter`, `hasFrontmatter` |
| `checksum.ts` | `sha256File`, `sha256String` |
| `args.ts` | `parseArgs`, `getOption`, `getFlag` |
| `keywords.ts` | `deriveKeywords` |
| `agents-md.ts` | `parseAgentsMd` |
| `fs-utils.ts` | `ensureDir`, `copyFile`, `readTextFile`, `writeTextFile`, `fileExists`, `expandHome` |
