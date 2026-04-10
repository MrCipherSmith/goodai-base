# PRD: Sub-Agents Based on Skills — Native Claude Code Agent Generation

## 1. Overview

A system that automatically converts eligible goodai-base skills (SKILL.md files) into native Claude Code sub-agent definitions (`.claude/agents/*.md` format). The system includes selection criteria, a generator script, frontmatter mapping logic, and a sync workflow to keep generated agents up-to-date as skills evolve.

---

## 2. Context

- **Product:** goodai-base — shared AI coding knowledge base
- **Module:** Skills infrastructure / Agent generation pipeline
- **User Role:** Developer or AI orchestrator invoking skills or sub-agents from goodai-base
- **Tech Stack:** Bash/Python generator, Markdown SKILL.md frontmatter YAML, Claude Code native agent format (`.claude/agents/*.md`)

---

## 3. Problem Statement

goodai-base skills are invoked by the main agent via the `Skill` tool. They run inside the main agent's context, sharing token budget and lacking isolation. Claude Code natively supports `.claude/agents/*.md` sub-agents with their own system prompts, optional model selection, and optional tool restrictions.

Currently there is no mechanism to:
- Determine which skills would benefit from native sub-agent form
- Generate valid agent files from SKILL.md sources
- Keep them synchronized when skills are updated

---

## 4. Goals

- Define clear, objective criteria for classifying a skill as "agent-worthy"
- Implement a generator script that reads SKILL.md files and produces `.claude/agents/*.md` output
- Define a deterministic frontmatter mapping: skill metadata → agent frontmatter (name, description, model, tools)
- Implement a sync workflow (manual trigger + optional git hook) to regenerate agents when skills change
- Produce a registry file that tracks the skill → agent mapping and sync state

---

## 5. Non-Goals

- Modifying the SKILL.md format or any existing skill content
- Converting ALL skills — only "agent-worthy" ones per defined criteria
- Auto-deploying generated agents to any remote or external system
- Rewriting the Skill tool invocation mechanism in Claude Code
- Converting non-Claude-Code skill variants (SKILL.cursor.md, SKILL.zed.md, etc.)
- Migrating existing `.claude/agents/` definitions created manually with no corresponding SKILL.md

---

## 6. Functional Requirements

**FR-1: Agent-Worthiness Criteria**
A skill qualifies as agent-worthy if it meets ALL of the following:
- Has a `SKILL.md` with valid YAML frontmatter (name, description, metadata)
- Content explicitly states it is designed to run autonomously
- Workflow is self-contained: inputs come from a structured contract, not interactive prompts
- Execution benefits from context isolation (long multi-phase workflow with large file reads)
- Has at least one defined input contract (JSON task object, schema, or structured template)
- Has `metadata.agent_worthy: true` in frontmatter (machine-readable source of truth)

**FR-2: Generator Script** — `scripts/generate-agents.sh` that:
- Scans `skills/*/SKILL.md`
- Evaluates `agent_worthy` flag
- Generates `.claude/agents/<skill-name>.md` for each qualifying skill
- Applies frontmatter mapping
- Emits a summary: `Generated: N | Updated: N | Skipped: N | Errors: N`

**FR-3: Frontmatter Mapping**

| SKILL.md field | Agent field | Notes |
|---|---|---|
| `name` | `name` | Direct copy |
| `description` | `description` | Direct copy |
| `metadata.model` (optional) | `model` | Omit if not set |
| `metadata.tools` (optional, array) | `tools` | Omit if not set |
| SKILL.md body (below frontmatter) | system prompt body | Full instructional content |

**FR-4: Sync Workflow** — `scripts/sync-agents.sh` that:
- Detects changed SKILL.md files by checksum
- Regenerates only stale agents
- Optionally registers as a git pre-commit hook

**FR-5: Agent Registry** — `skills/agents-registry.json` tracking:
```json
{
  "agents": [
    {
      "skill_name": "task-implementer",
      "source": "skills/task-implementer/SKILL.md",
      "agent_path": ".claude/agents/task-implementer.md",
      "generated_at": "2026-04-10T09:00:00Z",
      "source_checksum": "abc123"
    }
  ]
}
```

**FR-6: Validation** — Generator validates:
- Frontmatter is valid YAML
- `name` and `description` are non-empty
- Body is non-empty
- No duplicate `name` values

---

## 7. Non-Functional Requirements

- **NFR-1 Idempotency:** Repeated runs on unchanged skills produce identical output without modifying files
- **NFR-2 No Side Effects:** Generator does not modify skill sources, CLAUDE.md files, or project configs outside `agents-registry.json` and `.claude/agents/`
- **NFR-3 Portability:** Runs on macOS and Linux with bash 3.2+ or Python 3.8+, no external dependencies
- **NFR-4 Traceability:** Each generated agent file includes a header comment with source SKILL.md path and generation timestamp
- **NFR-5 Speed:** Full scan and generation over all skills completes in under 5 seconds

---

## 8. Constraints

- Generated agent files MUST conform to Claude Code native format: YAML frontmatter `---` block followed by Markdown body; `name` must be unique
- Generator MUST NOT overwrite manually authored `.claude/agents/*.md` files not tracked in the registry
- The `agent_worthy` flag MUST live in SKILL.md frontmatter as `metadata.agent_worthy: true`
- Generator defaults output to `~/.claude/agents/` with `--output-dir` override flag
- Existing `Skill` tool invocation continues to work unchanged

---

## 9. Edge Cases

| Case | Handling |
|------|----------|
| Skill with no `metadata` block | Skip with warning |
| Skill with `agent_worthy: true` but empty body | Error for that skill |
| Name collision between two skills | Error and skip second; user must resolve |
| Manually edited generated agent, source unchanged | No overwrite |
| Manually edited generated agent, source changed | Warn + confirm (interactive) or skip (CI mode) |
| Skill removed from goodai-base | Corresponding agent NOT auto-deleted; log stale-agent warning |
| Unknown tool name in `tools` field | Copy as-is; Claude Code handles at runtime |
| Generator run outside goodai-base | Exit with clear error message |

---

## 10. Acceptance Criteria (Gherkin)

```gherkin
Feature: Agent-Worthiness Detection

  Scenario: Skill with agent_worthy flag is included
    Given a SKILL.md with frontmatter "metadata.agent_worthy: true"
    When the generator script is run
    Then a .claude/agents/<skill-name>.md file is created

  Scenario: Skill without agent_worthy flag is skipped
    Given a SKILL.md without "agent_worthy: true"
    When the generator script is run
    Then no agent file is created for that skill
    And the generator output lists the skill as "skipped"

Feature: Frontmatter Mapping

  Scenario: Name and description are mapped
    Given a SKILL.md with "name: task-implementer" and a description
    When the generator produces the agent file
    Then the agent's YAML frontmatter contains those values verbatim

  Scenario: Optional model field is included when present
    Given a SKILL.md with "metadata.model: claude-opus-4-5"
    When the generator produces the agent file
    Then the agent frontmatter contains "model: claude-opus-4-5"

  Scenario: Optional model field is omitted when absent
    Given a SKILL.md with no metadata.model field
    When the generator produces the agent file
    Then the agent frontmatter does NOT contain a "model:" key

  Scenario: Tools field is mapped when present
    Given a SKILL.md with "metadata.tools: [Read, Bash, Glob]"
    When the generator produces the agent file
    Then the agent frontmatter contains "tools: [Read, Bash, Glob]"

Feature: Idempotency

  Scenario: Re-running generator on unchanged skill produces no changes
    Given an agent already generated and source SKILL.md unchanged
    When the generator script is run again
    Then the agent file is not modified and the registry checksum is unchanged

Feature: Sync Workflow

  Scenario: Changed skill triggers agent regeneration
    Given an agent generated from a SKILL.md that has since been modified
    When the sync script is run
    Then the agent file is regenerated with updated content
    And the registry checksum is updated

  Scenario: Unchanged skill is not regenerated
    Given a SKILL.md checksum matching the registry
    When the sync script is run
    Then the agent file is NOT modified

Feature: Non-Destructive Operation

  Scenario: Manually authored agent is not overwritten
    Given a .claude/agents/ file with no entry in agents-registry.json
    When the generator script is run
    Then the file is not modified and the generator logs it as "manually managed, skipped"
```

---

## 11. Verification

1. **Unit — Criteria detection:** Add `agent_worthy: true` to a fixture SKILL.md → run generator → confirm agent file created. Remove flag → confirm no file created.
2. **Unit — Frontmatter mapping:** Fixture with all optional fields → confirm generated YAML matches exactly. Fixture with only required fields → confirm no extra keys.
3. **Integration — Full scan:** Run generator against live `skills/` directory → confirm agents created for all flagged skills; confirm no manually authored agents modified.
4. **Idempotency:** Run generator twice on unchanged skills → confirm file mtimes and checksums are identical on second run.
5. **Sync test:** Modify SKILL.md body → run sync → confirm agent reflects change. Run sync again → confirm no files modified.
6. **Registry test:** Inspect `skills/agents-registry.json` after generation → verify all entries have valid non-empty checksum and timestamp.

**CI integration:** Add step `scripts/sync-agents.sh --dry-run` that fails if any agents are out of sync with source SKILL.md.

---

## 12. Deliverables

| Artifact | Path |
|----------|------|
| Generator script | `~/goodai-base/scripts/generate-agents.sh` |
| Sync script | `~/goodai-base/scripts/sync-agents.sh` |
| Agent registry | `~/goodai-base/skills/agents-registry.json` |
| This PRD | `~/goodai-base/jobs/prd-skill-automation/prd-3-sub-agents.md` |

**Skills to flag `agent_worthy: true` in v1 (candidates):**
- `task-implementer` — self-contained JSON input, 6-phase autonomous workflow
- `issue-analyzer` — read-only analysis, structured JSON output
- `context-collector` — 5-phase workflow, large file reads
- `feature-analyzer` — deep analysis requiring isolation
- `job-documenter` — invoked by orchestrator, structured actions
