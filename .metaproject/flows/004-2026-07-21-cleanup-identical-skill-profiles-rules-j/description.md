# Cleanup: identical profiles + rules.json + mcp gitignore

## Problem
Byte-identical platform skill files add noise after strategy A. rules.json has 13 orphans vs AGENTS catalog. Local MCP configs with absolute paths should not be committed.

## Expected Outcome
Identical SKILL.{cursor,codex,opencode,zed}.md removed; orphans resolved via AGENTS catalog + regenerate rules.json; gitignore for machine-local MCP configs; PR.

## Out of Scope
Deleting platform files that differ from SKILL.md; SKILL.claude.md cleanup; Grok sync target.
