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
# Validate and sync skills to all agent directories
cd scripts && bun run validate-skills-before-sync
cd scripts && bun run sync-skills

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

`sync-skills` copies platform-specific skill variants to:

1. `~/.cursor/skills/`
2. `~/.codex/skills/`
3. `~/.antigravity/skills/`
4. `~/.config/zed/skills/`
5. `~/.config/opencode/skills/`
6. `~/.claude/skills/`

And Claude slash commands (`SKILL.claude.md`) to `~/.claude/commands/`.

## Shared modules (`src/shared/`)

| Module | Exports |
|---|---|
| `frontmatter.ts` | `parseSkillFrontmatter`, `parseRuleFrontmatter`, `hasFrontmatter` |
| `checksum.ts` | `sha256File`, `sha256String` |
| `args.ts` | `parseArgs`, `getOption`, `getFlag` |
| `keywords.ts` | `deriveKeywords` |
| `agents-md.ts` | `parseAgentsMd` |
| `fs-utils.ts` | `ensureDir`, `copyFile`, `readTextFile`, `writeTextFile`, `fileExists`, `expandHome` |
