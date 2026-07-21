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
| `sync-zcode` | Install the `goodai-zcode` plugin into `~/.zcode/cli/plugins/` (file-drop) |
| `generate-skill-catalog` | Regenerate `docs/skill-catalog.md` and `docs/ai/skill-catalog.yaml` |
| `generate-rules-catalog` | Regenerate `docs/rules-catalog.md` |
| `generate-skill-registry` | Regenerate `hooks/skill-registry.json` from skills frontmatter |
| `generate-rules-json` | Regenerate `rules.json` from AGENTS.md |
| `generate-agents` | Generate `~/.claude/agents/<name>.md` from agent-worthy skills |
| `generate-codex-plugins` | Build Codex plugin bundles under `plugins/` from skills + rules |
| `generate-zcode-plugin` | Build the ZCode plugin bundle under `plugins/goodai-zcode/` from skills + rules |
| `validate-rules-json` | Validate `rules.json` against AGENTS.md |
| `validate-skills-before-sync` | Pre-sync gate: requires `SKILL.md` + frontmatter; platform variants optional |
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

## Validation policy (strategy A)

`validate-skills-before-sync`:

- **Requires** `skills/<name>/SKILL.md` with valid YAML frontmatter (`name`, `description`).
- **Does not require** platform files (`SKILL.cursor.md`, `SKILL.codex.md`, …).
- Validates any present `SKILL.<platform>.md` the same way.
- `sync-skills` falls back to `SKILL.md` when a platform variant is missing.

```bash
cd scripts && bun run validate-skills-before-sync && bun run sync-skills
```

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
| ZCode | — *(plugin)* | `~/.zcode/cli/plugins/cache/goodai-base/goodai-zcode/<version>/AGENTS.md` | — |

### Grok

Grok is **not** a `sync_tools` target by default. After syncing to Claude Code, Grok discovers goodai skills from `~/.claude/skills/` via Claude compatibility (`[compat.claude] skills = true`). Smoke: `grok inspect`. Optional: point Grok at the repo with `[skills] paths = ["~/goodai-base/skills"]` in `~/.grok/config.toml`.

> **ZCode is plugin-based.** Unlike the others, ZCode does not scan a plain
> skills directory — it loads skills only through its plugin/marketplace system.
> `sync-skills` therefore does not handle ZCode. Instead, build the bundle with
> `bun run generate-zcode-plugin` and install it with `bun run sync-zcode` (or
> select ZCode in `bun setup.ts`, which runs both automatically). The installed
> plugin lives at `~/.zcode/cli/plugins/cache/goodai-base/goodai-zcode/<version>/`
> and is registered in `~/.zcode/cli/plugins/marketplaces/goodai-base/marketplace.json`.

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
