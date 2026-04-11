# Contributing

## Adding a skill

1. Create a directory under `skills/<name>/`
2. Write the primary definition in `SKILL.md` following the structure in `rules/core/skills-storage-workflow.mdc`
3. Add platform variants: `SKILL.cursor.md`, `SKILL.codex.md`, `SKILL.zed.md`, `SKILL.opencode.md`
4. Register the skill in `AGENTS.md` under the appropriate category in the Skills Catalog section
5. Run `./scripts/generate-skill-catalog.sh` to update `docs/skill-catalog.md`
6. Run `./scripts/sync-skills.sh` to verify the skill syncs correctly

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
4. Run `./scripts/generate-rules-catalog.sh` to update `docs/rules-catalog.md`

## Code style

- Shell scripts: POSIX-compatible where possible, bash where needed
- Skill definitions: use clear, imperative language — the agent executes these literally
- Rules: declarative standards, not step-by-step instructions

## Pull requests

- One skill or rule per PR where possible
- The PR description must explain **when** the skill/rule is used, not just what it does
- If modifying an existing skill, bump the `version` field in `SKILL.md`
- Run `./scripts/sync-skills.sh` before submitting — PRs that break sync are rejected
