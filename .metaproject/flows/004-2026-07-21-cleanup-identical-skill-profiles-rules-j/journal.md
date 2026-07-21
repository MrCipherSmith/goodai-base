# Journal — Flow 004 cleanup

## Changes

1. **Deleted 66** byte-identical `SKILL.{cursor,codex,opencode,zed}.md` (remaining identical: 0).
2. **AGENTS.md** Skills Catalog: added catalog blocks for 13 orphan skills (legacy review + gproject phases + pr-review-comments).
3. **rules.json** regenerated — orphan warnings **0** (`Validation PASSED: all 75 entries are valid`).
4. **.gitignore**: `.cursor/mcp.json`, `.mcp.json`.

## Verify

- `bun test validate-skills-before-sync` → 18 pass
- `validate-skills-before-sync` → PASS, 183 profile files, no orphans
- `sync-skills` → PASS
- `git check-ignore` confirms mcp configs ignored
