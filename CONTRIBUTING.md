# Contributing

## Adding a skill

1. Create a directory under `skills/<name>/`
2. Write the primary definition in `SKILL.md` following the structure in `rules/core/skills-storage-workflow.mdc` (canonical source of truth)
3. **Optional:** add platform variants (`SKILL.cursor.md`, `SKILL.codex.md`, `SKILL.zed.md`, `SKILL.opencode.md`) **only when** content must differ from `SKILL.md`. Otherwise omit them — `sync-skills` falls back to the canonical file.
4. Register the skill in `AGENTS.md` under the appropriate category in the Skills Catalog section
5. Run `cd scripts && bun run generate-skill-catalog` to update `docs/skill-catalog.md`
6. Run `cd scripts && bun run validate-skills-before-sync && bun run sync-skills` to verify validation and sync

The CI pipeline regenerates catalogs automatically on merge to `main`.

### Skill description format

The `description:` field in SKILL.md frontmatter must be a **trigger condition**, not a workflow summary:

```yaml
# ✅ Correct — trigger condition
description: "Use when committing changes and a well-structured commit message is needed."

# ❌ Wrong — workflow summary
description: "Auto-stages changes, analyzes diff, generates conventional commit message."
```

Agents read the description to decide whether to load the skill. A workflow summary gives no routing signal and causes agents to skip the skill body.

### Anti-rationalization

If your skill enforces a non-obvious rule or process, add a **Red Flags** section with first-person rationalizations an agent might use to skip the step, and concrete rebuttals. See `skills/code-review/SKILL.md` for an example.

### SUBAGENT-STOP

If your skill is meant for interactive sessions or orchestrator-level use only (not for dispatched subagents), add a `<SUBAGENT-STOP>` block immediately after the YAML frontmatter closing `---`. See `skills/job-orchestrator/SKILL.md` for an example.

## Adding a rule

1. Create `rules/core/<name>.mdc` with a YAML frontmatter block:
   ```yaml
   ---
   description: One-line description of what this rule covers
   globs: []
   alwaysApply: false
   ---
   ```
2. Write the rule content — keep it focused on a single domain
3. Register it in the `AGENTS.md` Core Rule Catalog section
4. Run `cd scripts && bun run generate-rules-catalog` to update `docs/rules-catalog.md`

## Code style

- Scripts: TypeScript (Bun runtime) — see `scripts/README.md`
- Skill definitions: use clear, imperative language — the agent executes these literally
- Rules: declarative standards, not step-by-step instructions

## Pull requests

- One skill or rule per PR where possible
- The PR description must explain **when** the skill/rule is used, not just what it does
- If modifying an existing skill, bump the `version` field in `SKILL.md`
- Run `cd scripts && bun run sync-skills` before submitting — PRs that break sync are rejected
