# Journal — Flow 002 Day 1

## Implementation

### Validator (`scripts/src/validate-skills-before-sync.ts`)

- Removed hard-require of `SKILL.cursor.md` / `SKILL.codex.md`
- Requires valid `SKILL.md` (exists + frontmatter)
- Still validates present `SKILL.{cursor,codex,zed,opencode}.md`
- Did **not** expand validation to `SKILL.claude.md` (pre-existing files lack `name`; would break sync)

### Tests

- 18 pass, 0 fail (`bun test validate-skills-before-sync`)
- Cases: canonical-only OK; missing cursor/codex OK; missing SKILL.md FAIL

### Docs

- CONTRIBUTING.md — optional platform variants
- rules/core/skills-storage-workflow.mdc — strategy A + bun run commands
- scripts/README.md — validation policy + Grok note
- docs/onboarding.md — **Grok integration** section

### Verify

```text
bun test validate-skills-before-sync → 18 pass
bun run validate-skills-before-sync → PASS (179+ SKILL.md counted; rules.json 13 orphan warnings)
bun run sync-skills → PASS without --skip-validation
```
