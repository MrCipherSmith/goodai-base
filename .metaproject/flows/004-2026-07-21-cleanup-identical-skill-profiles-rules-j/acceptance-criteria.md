# Acceptance Criteria

Rules:

- Criteria lines use the exact format `- ACn: <criterion>`.
- After `flow freeze` this file is checksum-protected.
- Completion requires every ACn confirmed via `keryx flow ac confirm`.

## Criteria

- AC1: No remaining byte-identical SKILL.{cursor,codex,opencode,zed}.md vs SKILL.md
- AC2: validate-rules-json reports 0 orphaned entry warnings
- AC3: .gitignore excludes .cursor/mcp.json and .mcp.json; files remain untracked/local
- AC4: bun run validate-skills-before-sync && bun run sync-skills pass
- AC5: draft PR opened and merged to main
