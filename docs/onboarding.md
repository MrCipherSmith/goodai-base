# goodai-base Onboarding Guide

Welcome to **goodai-base** — a shared knowledge base for AI-assisted development. This guide explains the core concepts and how to get started quickly.

---

## What is goodai-base?

goodai-base is a structured repository of:

- **Skills** — reusable workflows that Claude can execute on demand (code review, commit, feature analysis, etc.)
- **Rules** — coding standards and guidelines that are automatically injected when relevant
- **Scripts** — tooling to deploy, sync, and validate skills and rules across projects

The goal: write your AI workflows once, deploy them everywhere.

---

## How Skills Work

Skills live in `skills/<skill-name>/SKILL.md`. Each skill has YAML frontmatter defining its identity and a body describing the workflow.

### Invoking a skill

In Claude Code, prefix your request with the skill name as a slash command:

```
/commit
/code-review
/job-orchestrator
```

Claude matches the slash command against the skill catalog and loads the full workflow definition.

### Skill frontmatter fields

| Field | Purpose |
| ----- | ------- |
| `name` | Unique identifier (kebab-case) |
| `description` | Trigger condition — describes WHEN to use this skill, not what it does. Must start with `"Use when..."` |
| `triggers` | Phrases that activate the skill |
| `metadata.version` | Semantic version |
| `metadata.category` | Grouping label (workflow, review, analysis, …) |
| `metadata.agent_worthy` | If `true`, the skill can run as a native Claude Code sub-agent |

> **Why trigger-condition descriptions matter:** When an agent scans the skill catalog to decide which skill to load, it reads only the `description` field. If the description summarizes the workflow ("This skill does X, Y, Z"), the agent has no basis for deciding whether the skill is relevant — it describes mechanics, not applicability. A trigger-condition description ("Use when the user asks to analyze branch changes") gives the agent the signal it needs to load the right skill and skip irrelevant ones.

### Auto-detection

`detect-context` scores incoming prompts against `rules.json` (which indexes all skills and rules). Matching skills are surfaced as suggestions; matching rules are injected as context.

---

## How Rules Work

Rules live in `rules/core/<rule-name>.mdc`. They contain coding standards, patterns, and conventions for specific domains (TypeScript, MobX, NestJS, Git, etc.).

### Auto-injection

When you submit a prompt, `detect-context` runs keyword and intent matching. If a rule's triggers match, its content is injected as context before Claude answers — you don't need to invoke rules manually.

Rules with `alwaysApply: true` are always injected regardless of prompt content.

### Manual loading

You can reference a rule directly in your prompt:

```
Apply code-style-patterns to the following code: ...
```

---

## How to Add a Skill

1. **Create the skill directory and SKILL.md:**

   ```bash
   mkdir skills/my-skill
   ```

   Add `skills/my-skill/SKILL.md` with this frontmatter:

   ```yaml
   ---
   name: my-skill
   description: "Use when the user asks to do X, or when Y condition is met."
   triggers:
     - "/my-skill"
     - "Run my skill"
   metadata:
     author: "your-name"
     version: "1.0.0"
     category: "workflow"
   license: "MIT"
   compatibility: "cursor,codex,claude"
   ---

   # My Skill

   ## Purpose
   ...
   ```

2. **Regenerate the registries:**

   ```bash
   cd scripts
   bun run generate-skill-registry   # updates hooks/skill-registry.json
   bun run generate-rules-json        # updates rules.json
   ```

3. **Add to AGENTS.md** under the Skills Catalog section so it appears in the routing table.

4. **Validate before sync:**

   ```bash
   cd scripts && bun run validate-skills-before-sync
   ```

5. **Optional — make it a native sub-agent:**

   Add `agent_worthy: true` under `metadata` in SKILL.md, then run:

   ```bash
   cd scripts && bun run sync-agents
   ```

   This generates a `.claude/agents/<skill-name>.md` file that Claude Code can spawn as a background agent.

6. **Deploy to a project:**

   ```bash
   cd scripts && bun run deploy-skill-hook /path/to/your-project
   ```

   This installs the skill-evaluator hook into the target project's `.claude/` directory.

---

## Artifact Paths (JOBS_ROOT and DOCS_ROOT)

All generated artifacts are written to project-local directories, not to `~/goodai-base/`. Both paths follow the same resolution order:

| Variable | Default | Override |
|---|---|---|
| `JOBS_ROOT` | `<PROJECT_DIR>/jobs/` | `GOODAI_JOBS_ROOT` env var |
| `DOCS_ROOT` | `<PROJECT_DIR>/docs/` | `GOODAI_DOCS_ROOT` env var |

**Resolution order (both):**
1. Value passed explicitly by the orchestrator in the sub-agent dispatch prompt
2. `GOODAI_JOBS_ROOT` / `GOODAI_DOCS_ROOT` environment variable (if set)
3. `<PROJECT_DIR>/jobs/` or `<PROJECT_DIR>/docs/` — default

**Key rule:** Sub-agents never resolve these paths themselves. The orchestrator resolves them in Phase 0.2 (when `PROJECT_DIR` is confirmed) and passes them explicitly in every dispatch prompt.

To override globally for all projects on a machine:
```bash
export GOODAI_JOBS_ROOT=~/shared/jobs
export GOODAI_DOCS_ROOT=~/shared/docs
```

---

## Multi-Agent Patterns

When skills orchestrate sub-agents (e.g., `job-orchestrator` dispatching `task-implementer` or `code-ai-review`), two protocol rules apply:

- **`rules/core/subagent-status-protocol.md`** — Every subagent response must begin with a `STATUS:` prefix using one of four types: `DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, or `NEEDS_CONTEXT`. Orchestrators must read this prefix before deciding to proceed, escalate, or re-dispatch.

- **`rules/core/subagent-context-construction.md`** — Orchestrators must explicitly construct a context block for each subagent dispatch (repo path, branch, task description, relevant files, etc.). Subagents must not be expected to infer context from ambient conversation — every dispatch is self-contained.

These rules prevent silent failures and context drift in multi-step pipelines.

---

## Quick Reference

| Resource | Location |
| -------- | -------- |
| Skills map & interaction diagram | [skills-overview.md](./skills-overview.md) |
| All skills | [skill-catalog.md](./skill-catalog.md) |
| All rules | [rules-catalog.md](./rules-catalog.md) |
| Machine-readable skill catalog | [ai/skill-catalog.yaml](./ai/skill-catalog.yaml) |
| Routing table | [AGENTS.md](../AGENTS.md) |
| Unified trigger registry | [rules.json](../rules.json) |
| Agent deep-dives | [agents/job-orchestrator.md](./agents/job-orchestrator.md), [agents/tests-creator.md](./agents/tests-creator.md), [agents/code-verifier.md](./agents/code-verifier.md) |
| Hook for projects | `cd scripts && bun run deploy-skill-hook <path>` |
| Sync sub-agents | `cd scripts && bun run sync-agents` |
| Validate before sync | `cd scripts && bun run validate-skills-before-sync` |

---

## Useful Scripts

All scripts run via Bun from the `scripts/` directory (`cd scripts && bun install` once):

```bash
# Generate docs catalogs
bun run generate-skill-catalog
bun run generate-rules-catalog

# Regenerate trigger registries
bun run generate-skill-registry
bun run generate-rules-json

# Validate skill profiles and rules registry
bun run validate-skills-before-sync

# Sync agent_worthy skills to native agents
bun run sync-agents

# Deploy hook to a project
bun run deploy-skill-hook /path/to/project

# Test context detection
echo "how do I review this code?" | bun run detect-context

# Run tests
bun test
```
