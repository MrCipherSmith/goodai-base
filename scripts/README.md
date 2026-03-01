# Scripts: Skills Sync

## Purpose
Utilities for synchronizing skills across agent environments.

## Canonical machine-readable schema
`~/goodea/goodai-base/rules/schemas/skill-workflow-result.schema.json`

This schema defines the orchestrator contract for skill workflow results (status, decision, errors, artifacts, timestamp).

## Validator script (pre-sync)
`~/goodea/goodai-base/scripts/validate-skills-before-sync.sh`

Checks before sync:
- schema file exists and passes sanity checks
- required skill profiles exist (`SKILL.cursor.md`, `SKILL.codex.md`)
- YAML frontmatter delimiters are valid
- required frontmatter keys exist (`name`, `description`)
- skill name format is valid

## Sync script
`~/goodea/goodai-base/scripts/sync-skills.sh`

Behavior:
- always runs validator first
- aborts on validation failure
- syncs `SKILL.<agent>.md` into target global skill directories
- also syncs AGENTS.md to `~/.config/opencode/AGENTS.md`
- fails if copy operation fails (no false "OK")

## Manual run (recommended order)
```bash
~/goodea/goodai-base/scripts/validate-skills-before-sync.sh
~/goodea/goodai-base/scripts/sync-skills.sh
```

## Targets
1. `~/.cursor/skills/`
2. `~/.codex/skills/`
3. `~/.antigravity/skills/`
4. `~/.config/zed/skills/`
5. `~/.config/opencode/skills/`

## Optional alias
```bash
echo 'alias sync-skills="~/goodea/goodai-base/scripts/sync-skills.sh"' >> ~/.zshrc
source ~/.zshrc
```
