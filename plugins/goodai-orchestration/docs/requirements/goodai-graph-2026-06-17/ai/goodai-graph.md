# PRD: GoodAI Graph

## 1. Overview

Build a deterministic typed knowledge graph for `goodai-base` repository metadata and routing assets. The graph is used by the agent to select skills and rules through graph relations, not only keyword matching. Validation and impact analysis support the routing goal.

## 2. Context

Product: `goodai-base`

Module: `scripts/src`, `skills`, `rules`, `plugins`, `docs`, routing

User Role: maintainer agent, reviewer agent, implementation agent

Tech Stack: Bun, TypeScript, Markdown, JSON Schema

## 3. Problem Statement

`goodai-base` currently routes requests primarily through manual keywords and catalog text. Agents need a deterministic graph that connects user intent concepts to skills, rules, schemas, plugins, and workflow dependencies so selection is explainable and less brittle.

## 4. Goals

- Generate `docs/goodai-graph.json`.
- Generate `docs/goodai-graph.md`.
- Provide graph-aware skill/rule routing for user requests.
- Explain why a skill/rule was selected and which dependencies should be loaded.
- Validate missing skill/rule/schema/plugin references.
- Provide impact and explanation commands for graph nodes.
- Keep graph generation local, deterministic, and CI-friendly.

## 5. Non-Goals

- No external graph database.
- No LLM extraction.
- No AST-wide source code graph in v1.
- No automatic rewrite of `AGENTS.md` in v1.
- No default indexing of `jobs/`.

## 6. Functional Requirements

FR-1: `generate-goodai-graph.ts` MUST discover canonical repository entities.

FR-2: The graph JSON MUST contain:

```json
{
  "schema_version": "1.0",
  "generated_at": "ISO-8601 timestamp",
  "nodes": [],
  "edges": []
}
```

FR-3: Node ids MUST be namespaced by type, for example `skill:review-orchestrator`, `rule:git-rules`, `schema:skills/review-orchestrator/input-contract.schema.json`.

FR-4: Supported node types MUST include `skill`, `rule`, `schema`, `plugin`, `script`, `doc`.

FR-5: Supported edge types MUST include `loads_rule`, `uses_schema`, `dispatches_skill`, `bundled_in_plugin`, `generated_by_script`, `documents`.

FR-6: `goodai-graph.ts route "<user request>"` MUST return ranked candidate skills/rules.

FR-7: Route output MUST include:

```json
{
  "request": "string",
  "candidates": [
    {
      "node_id": "skill:review-orchestrator",
      "score": 0,
      "reasons": [],
      "required_artifacts": []
    }
  ]
}
```

FR-8: Routing score MUST consider explicit mentions, trigger/keyword match, graph relation strength, dependency completeness, and plugin availability.

FR-9: Explicit skill/rule mention MUST outrank inferred matches unless the named node does not exist.

FR-10: Ambiguous orchestratable requests MUST still preserve the orchestrator-routing question policy where required by `AGENTS.md`.

FR-11: `validate-goodai-graph.ts` MUST fail for missing required targets.

FR-12: `validate-goodai-graph.ts` MUST report orphan candidates separately from hard errors.

FR-13: `goodai-graph.ts impact <path-or-id>` MUST return direct and transitive impacted nodes.

FR-14: `goodai-graph.ts why <node-id>` MUST return incoming and outgoing edges for the node.

FR-15: Graph generation MUST NOT modify current routing files.

## 7. Non-Functional Requirements

NFR-1: Runtime MUST be local-only.

NFR-2: Generation SHOULD complete in under 5 seconds for current repository size.

NFR-3: Output MUST be deterministic except `generated_at`.

NFR-4: Validator messages MUST include `severity`, `source`, `target`, `edge_type`, and `suggested_fix`.

NFR-5: Routing explanations MUST be concise enough for agent context use.

NFR-6: Implementation MUST use existing `scripts/src` conventions.

## 8. Constraints

- Existing canonical sources remain authoritative.
- `jobs/` is excluded by default.
- Generated plugin copies are treated as derived artifacts.
- Missing dependency validation must be conservative and avoid failing on prose-only mentions.
- Routing must not bypass explicit user instruction or required orchestrator-routing confirmation.
- No network access required.

## 9. Edge Cases

- Missing canonical `SKILL.md`.
- Schema path referenced with different relative forms.
- Generated plugin bundle stale compared to canonical skill source.
- Rule exists on disk but not in routing catalog.
- Skill mentioned in Markdown prose but not semantically dispatched.
- Duplicate basename across node types.

## 10. Acceptance Criteria (Gherkin)

```gherkin
Feature: GoodAI Graph artifact

  Scenario: Generate deterministic graph
    Given repository sources are unchanged
    When the graph generator runs twice
    Then both graph outputs have identical nodes and edges
    And only generated_at may differ

  Scenario: Include canonical entities
    Given the repository contains skills, rules, schemas, plugins, scripts and docs
    When the graph generator runs
    Then the graph contains nodes for every canonical skill
    And the graph contains nodes for every rule in rules/core
    And the graph contains nodes for every schema in rules/schemas and skills
    And the graph contains plugin nodes for Codex plugin bundles

  Scenario: Validate missing dependency
    Given a graph edge references a required target that does not exist
    When the graph validator runs
    Then validation fails
    And the failure includes source, target, edge type and suggested fix

  Scenario: Report orphan candidates
    Given a node is not reachable from primary entrypoints
    When the graph validator runs
    Then the node is reported as an orphan candidate
    And validation does not fail solely because of that orphan candidate

  Scenario: Analyze impact
    Given docs/goodai-graph.json exists
    When the impact command is run for a skill node
    Then direct impact includes connected rules, schemas and plugins
    And transitive impact includes downstream generated docs or plugin bundles

  Scenario: Route explicit skill request
    Given docs/goodai-graph.json exists
    And the request is "Run code-ai-review"
    When the route command is run
    Then skill:code-ai-review is the top candidate
    And the explanation includes "explicit skill mention"

  Scenario: Route ambiguous review request
    Given docs/goodai-graph.json exists
    And the request is "Review my code changes"
    When the route command is run
    Then skill:review-orchestrator is a top candidate
    And the output marks that orchestrator confirmation policy may apply
    And the output includes supporting review rules

  Scenario: Route standards request to rule
    Given docs/goodai-graph.json exists
    And the request is "How should I format commits?"
    When the route command is run
    Then rule:commit-message-formatting is a top candidate
    And no implementation skill is selected as mandatory

  Scenario: Preserve existing workflow
    Given AGENTS.md and rules.json are current routing sources
    When graph generation runs
    Then neither AGENTS.md nor rules.json is modified
```

## 11. Verification

```gherkin
Feature: Verification

  Scenario: Unit tests cover graph extraction
    Given parser fixtures for skills, rules, schemas and plugins
    When tests run
    Then node extraction is verified
    And edge extraction is verified

  Scenario: Unit tests cover route ranking
    Given resolver fixtures for explicit, ambiguous and standards requests
    When tests run
    Then explicit mentions outrank inferred matches
    And graph-related dependencies are returned with the selected candidate

  Scenario: Validator fails on fixture with missing schema
    Given a fixture skill references a missing schema
    When validator tests run
    Then the missing schema is reported as a hard error

  Scenario: Repository graph validates
    Given the current repository state
    When the generator and validator run
    Then validation passes or reports only known non-blocking orphan candidates
```
