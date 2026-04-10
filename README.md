# Base AI - Personal AI Assistant Configuration

Personal AI assistant setup - main knowledge base for working with AI agents.

## What's Included

### Skills (in `skills/`)
- `feature-analyzer` - Cross-repository analysis
- `job-orchestrator` - Task orchestration
- `job-documenter` - Job documentation
- `context-collector` - Context gathering
- `issue-analyzer` - Issue decomposition
- `task-implementer` - Task implementation
- `pr-review-comments` - PR comments analysis
- `pr-issue-documenter` - PR/issue documentation

### Rules (in `rules/core/`)
- Code style patterns
- DTO standards
- Git rules
- Testing guidelines
- And more...

## Setup

### 1. Sync Skills to Tools

Run the sync script to copy skills to your AI tools:

```bash
./scripts/sync-skills.sh
```

This syncs to:
- `~/.codex/skills`
- `~/.cursor/skills`
- `~/.antigravity/skills`
- `~/.config/zed/skills`
- `~/.config/opencode/skills`

And copies `AGENTS.md` to all tool targets (Cursor, Codex, Zed, OpenCode).

### 2. Prerequisites

Make sure validator script is executable:
```bash
chmod +x scripts/validate-skills-before-sync.sh
```

## Notes

- Jobs documentation goes to `~/goodai-base/jobs/`
- All paths in rules reference `~/goodai-base/`

## Project Structure

```
.
├── AGENTS.md       # Main entry rule (plain, synced to all tools)
├── AGENTS.mdc      # Same with YAML frontmatter (for Cursor alwaysApply)
├── rules/          # Rule files (.mdc)
│   └── core/       # Core rule files
├── scripts/        # Utility scripts
│   └── sync-skills.sh
├── skills/         # Skill definitions
└── jobs/           # Job documentation (created by job-documenter)
```
