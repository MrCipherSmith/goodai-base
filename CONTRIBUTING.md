# Contributing

## Adding a skill

1. Create a directory under `skills/<name>/`
2. Write the primary definition in `SKILL.md` following the structure in `rules/core/skills-storage-workflow.mdc`
3. Add platform variants: `SKILL.cursor.md`, `SKILL.codex.md`, `SKILL.zed.md`, `SKILL.opencode.md`
4. Register the skill in `AGENTS.md` under the appropriate category in the Skills Catalog section
5. Run `./scripts/generate-skill-catalog.sh` to update `docs/skill-catalog.md`
6. Run `./scripts/sync-skills.sh` to verify the skill syncs correctly

The CI pipeline regenerates catalogs automatically on merge to `main`.

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
- Include a short description of what the skill/rule does and when it should be used
- If modifying an existing skill, bump the `version` field in `SKILL.md`
