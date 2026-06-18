# PRD: GoodAI Graph

## 1. Overview

GoodAI Graph is a typed knowledge graph for `goodai-base` that helps the agent choose skills and rules using graph relations, not only keywords. It models relationships between intent, skills, rules, schemas, plugins, and workflows. Impact analysis and CI validation remain supporting capabilities, but the primary product outcome is more accurate graph-aware routing.

## 2. Context

Product: `goodai-base`

Module: routing, skill/rule selection, validation, plugin generation

User Role: goodai-base maintainers, AI coding assistants, contributors

Tech Stack: TypeScript/Bun scripts, Markdown skills/rules, JSON Schema, Codex plugin bundles

## 3. Problem Statement

Skill/rule selection in `goodai-base` currently depends mostly on a manual routing table and keywords in `AGENTS.md` / `rules.json`. This does not scale well: similar requests may need different skills, a skill may depend on specific rules or schemas, and new skills must be manually threaded through routing descriptions. Important relationships are spread across Markdown, JSON, schemas, plugin generation scripts, and documentation, so the agent cannot use a dependency graph when deciding what to load.

## 4. Goals

- Create a machine-readable graph artifact for core `goodai-base` entities.
- Use graph relations as an input for skill and rule selection.
- Give the agent explainable routing: why a skill/rule was selected and which dependencies were loaded.
- Validate critical links between skills, rules, schemas, plugins, and scripts.
- Give maintainers fast commands for impact analysis and missing/orphan dependency discovery.
- Generate a human-readable graph report for review and onboarding.

## 5. Non-Goals

- Do not build a full Graphify clone.
- Do not index all source code as an AST graph in the first iteration.
- Do not remove `AGENTS.md` or `rules.json` in the first iteration.
- Do not add an external runtime database such as Neo4j.
- Do not send repository content to external LLM APIs.
- Do not index `jobs/` by default because it contains session artifacts.

## 6. Functional Requirements

FR-1: The system must generate `docs/goodai-graph.json` from canonical repository sources.

FR-2: The graph must include nodes for at least these types: `skill`, `rule`, `schema`, `plugin`, `script`, `doc`.

FR-3: The graph must include edges for at least these types: `loads_rule`, `uses_schema`, `dispatches_skill`, `bundled_in_plugin`, `generated_by_script`, `documents`.

FR-4: The generator must read skill frontmatter, known schema references, plugin bundle definitions, and existing catalog artifacts without requiring network access.

FR-5: The validator must detect missing references for rules, schemas, skills, and plugin paths.

FR-6: The validator must detect orphaned graph nodes that are not reachable from primary entrypoints, but must not automatically classify them as errors without a severity classification.

FR-7: The system must provide a routing resolver that accepts user intent and returns ranked skill/rule candidates with an explanation.

FR-8: The routing resolver must consider at least keyword match, explicit triggers, graph distance from intent concepts, dependency completeness, plugin availability, and historical/manual priority if present.

FR-9: The routing resolver must return not only the selected skill/rule, but also required supporting artifacts: rules, schemas, references, and related skills.

FR-10: The routing resolver must support dry-run/explain mode so the agent can show why a skill/rule was selected.

FR-11: The CLI must support:

```bash
bun src/generate-goodai-graph.ts
bun src/validate-goodai-graph.ts
bun src/goodai-graph.ts route "<user request>"
bun src/goodai-graph.ts impact <path-or-id>
bun src/goodai-graph.ts why <node-id>
```

FR-12: The report generator must create `docs/goodai-graph.md` with summary, routing coverage, node counts, edge counts, missing references, orphan candidates, and high-impact nodes.

FR-13: The generated graph must be deterministic: the same input produces the same JSON ordering.

FR-14: CI/check mode must exit with a non-zero status when required dependencies are missing.

## 7. Non-Functional Requirements

NFR-1: The generator must run locally without network access.

NFR-2: For the current size of `goodai-base`, generation must complete in under 5 seconds on a normal developer machine.

NFR-3: The graph JSON format must be stable and versioned through a `schema_version` field.

NFR-4: The implementation must follow existing TypeScript/Bun patterns in `scripts/src`.

NFR-5: Validator errors must be actionable: they must identify the source file, missing target, and suggested fix.

NFR-6: Generated Markdown must be suitable for PR review.

## 8. Constraints

- The first iteration keeps the existing sources of truth: `skills/`, `rules/`, `plugins/`, `scripts/`, `AGENTS.md`, `rules.json`.
- The graph must not break existing sync/generate workflows.
- Avoid heavy dependencies when standard TypeScript parsing, Markdown frontmatter parsing, and JSON parsing are sufficient.
- The first iteration must not automatically rewrite `AGENTS.md` from the graph; the resolver must run alongside existing routing.
- `jobs/` must be excluded from the default graph scope.

## 9. Edge Cases

- A skill exists only as a platform-specific variant and has no canonical `SKILL.md`.
- A skill references a schema by relative path and by bare filename.
- A rule exists on disk but is missing from the `AGENTS.md` catalog.
- A plugin bundle includes a skill but misses required shared files.
- A generated plugin copy is stale compared to the canonical source.
- Markdown mentions a skill name in prose, but it is not a real dependency.
- A node id collision occurs between a skill and a rule with the same name.

## 10. Acceptance Criteria (Gherkin)

```gherkin
Feature: GoodAI Graph generation

  Scenario: Generate graph from repository sources
    Given the goodai-base repository contains skills, rules, schemas, plugins and scripts
    When I run the graph generator
    Then docs/goodai-graph.json is created
    And the graph contains skill, rule, schema, plugin, script and doc nodes
    And the graph contains deterministic node and edge ordering

  Scenario: Detect missing schema reference
    Given a skill references a schema file that does not exist
    When I run the graph validator
    Then validation fails with a non-zero exit code
    And the output identifies the source skill and missing schema path

  Scenario: Inspect impact for a changed skill
    Given a graph has been generated
    When I run impact analysis for a skill id
    Then the output lists directly connected rules, schemas, plugins and generated docs
    And the output separates direct impact from transitive impact

  Scenario: Preserve existing routing workflow
    Given AGENTS.md and rules.json remain the current routing sources
    When GoodAI Graph is generated
    Then no existing routing file is modified automatically

  Scenario: Route user request through graph relations
    Given the graph contains skills, rules and intent concepts
    When I run route analysis for "review my code changes"
    Then the resolver returns review-orchestrator as a ranked candidate
    And the resolver explains the keyword and graph-relation evidence
    And the resolver includes supporting rules and schemas required by the selected skill

  Scenario: Prefer explicit skill over graph inference
    Given the user request explicitly names "code-ai-review"
    When I run route analysis for the request
    Then the resolver ranks code-ai-review first
    And the resolver explains that explicit skill mention overrides weaker graph matches
```

## 11. Verification

- Run unit tests for graph parsing, id generation, edge extraction, routing ranking, and validator failures.
- Run the generator on the repository and review `docs/goodai-graph.json`.
- Run the validator in success mode on the current repository.
- Run resolver fixtures for explicit skill names, ambiguous review requests, standards/rules requests, and unsupported intents.
- Add at least one fixture-based test for a missing dependency.
- Run existing script validation relevant to generated catalogs and plugin bundles.
