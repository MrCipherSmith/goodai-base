## Summary

<!-- What does this PR add or change, and WHY? -->

## Type

- [ ] New skill
- [ ] Updated skill
- [ ] New rule
- [ ] Updated rule
- [ ] Infrastructure / scripts
- [ ] Documentation

## Skill/Rule quality checklist

- [ ] `description:` is a trigger condition ("Use when X"), not a workflow summary
- [ ] If the skill enforces a non-obvious process — Red Flags table added with ≥3 first-person rationalizations
- [ ] If the skill is for orchestrators/interactive sessions only — `<SUBAGENT-STOP>` guard added after frontmatter
- [ ] If a subagent skill — `## Reporting Results` section present with STATUS: protocol

## Mechanics checklist

- [ ] `AGENTS.md` updated if adding a skill or rule
- [ ] Catalogs regenerated (`./scripts/generate-skill-catalog.sh` / `generate-rules-catalog.sh`)
- [ ] Skill version bumped if modifying an existing skill
- [ ] `./scripts/sync-skills.sh` runs without errors
- [ ] Platform variants added for new skills (`.cursor.md`, `.codex.md`, `.zed.md`, `.opencode.md`)
