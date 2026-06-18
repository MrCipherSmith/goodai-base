# GoodAI Graph

_Auto-generated from repository skills, rules, schemas, plugins, scripts, and docs._

Generated at: 2026-06-18T08:40:14.280Z

## Summary

- Nodes: 559
- Edges: 712
- Validation errors: 0
- Validation warnings: 78

## Node Counts

- doc: 27
- intent: 387
- plugin: 5
- rule: 29
- schema: 26
- script: 23
- skill: 62

## Edge Counts

- bundled_in_plugin: 124
- dispatches_skill: 8
- documents: 91
- generated_by_script: 6
- loads_rule: 10
- matches_intent: 435
- uses_schema: 38

## Routing Coverage

- Skill/rule candidates: 91
- Intent edges: 435
- Dependency edges: 48

## Findings

- WARNING: Orphan candidate: doc:docs/agent-discipline/phase-1-cso-descriptions.md (docs/agent-discipline/phase-1-cso-descriptions.md -> doc:docs/agent-discipline/phase-1-cso-descriptions.md)
- WARNING: Orphan candidate: doc:docs/agent-discipline/phase-2-anti-rationalization.md (docs/agent-discipline/phase-2-anti-rationalization.md -> doc:docs/agent-discipline/phase-2-anti-rationalization.md)
- WARNING: Orphan candidate: doc:docs/agent-discipline/phase-3-subagent-stop.md (docs/agent-discipline/phase-3-subagent-stop.md -> doc:docs/agent-discipline/phase-3-subagent-stop.md)
- WARNING: Orphan candidate: doc:docs/agent-discipline/phase-4-subagent-status-protocol.md (docs/agent-discipline/phase-4-subagent-status-protocol.md -> doc:docs/agent-discipline/phase-4-subagent-status-protocol.md)
- WARNING: Orphan candidate: doc:docs/agent-discipline/phase-5-two-stage-review.md (docs/agent-discipline/phase-5-two-stage-review.md -> doc:docs/agent-discipline/phase-5-two-stage-review.md)
- WARNING: Orphan candidate: doc:docs/agent-discipline/phase-6-explicit-context.md (docs/agent-discipline/phase-6-explicit-context.md -> doc:docs/agent-discipline/phase-6-explicit-context.md)
- WARNING: Orphan candidate: doc:docs/agent-discipline/README.md (docs/agent-discipline/README.md -> doc:docs/agent-discipline/README.md)
- WARNING: Orphan candidate: doc:docs/agents/code-verifier.md (docs/agents/code-verifier.md -> doc:docs/agents/code-verifier.md)
- WARNING: Orphan candidate: doc:docs/agents/job-orchestrator.md (docs/agents/job-orchestrator.md -> doc:docs/agents/job-orchestrator.md)
- WARNING: Orphan candidate: doc:docs/agents/tests-creator.md (docs/agents/tests-creator.md -> doc:docs/agents/tests-creator.md)
- WARNING: Orphan candidate: doc:docs/autodoc-pipeline.md (docs/autodoc-pipeline.md -> doc:docs/autodoc-pipeline.md)
- WARNING: Orphan candidate: doc:docs/codex-plugins.md (docs/codex-plugins.md -> doc:docs/codex-plugins.md)
- WARNING: Orphan candidate: doc:docs/gproject-pipeline.md (docs/gproject-pipeline.md -> doc:docs/gproject-pipeline.md)
- WARNING: Orphan candidate: doc:docs/greptile-integration.md (docs/greptile-integration.md -> doc:docs/greptile-integration.md)
- WARNING: Orphan candidate: doc:docs/model-selection-test.md (docs/model-selection-test.md -> doc:docs/model-selection-test.md)
- WARNING: Orphan candidate: doc:docs/onboarding.md (docs/onboarding.md -> doc:docs/onboarding.md)
- WARNING: Orphan candidate: doc:docs/requirements/goodai-graph-2026-06-17/ai/goodai-graph.md (docs/requirements/goodai-graph-2026-06-17/ai/goodai-graph.md -> doc:docs/requirements/goodai-graph-2026-06-17/ai/goodai-graph.md)
- WARNING: Orphan candidate: doc:docs/requirements/goodai-graph-2026-06-17/en/goodai-graph.md (docs/requirements/goodai-graph-2026-06-17/en/goodai-graph.md -> doc:docs/requirements/goodai-graph-2026-06-17/en/goodai-graph.md)
- WARNING: Orphan candidate: doc:docs/requirements/goodai-graph-2026-06-17/ru/goodai-graph.md (docs/requirements/goodai-graph-2026-06-17/ru/goodai-graph.md -> doc:docs/requirements/goodai-graph-2026-06-17/ru/goodai-graph.md)
- WARNING: Orphan candidate: doc:docs/review-domain.md (docs/review-domain.md -> doc:docs/review-domain.md)
- WARNING: Orphan candidate: doc:docs/skills-overview.md (docs/skills-overview.md -> doc:docs/skills-overview.md)
- WARNING: Missing target node: rule:code-review-boss-profile (rules.json -> rule:code-review-boss-profile)
- WARNING: Missing target node: rule:code-review-boss-profile (rules.json -> rule:code-review-boss-profile)
- WARNING: Missing target node: rule:code-review-boss-profile (rules.json -> rule:code-review-boss-profile)
- WARNING: Missing target node: rule:code-review-boss-profile (rules.json -> rule:code-review-boss-profile)
- WARNING: Missing target node: rule:code-review-boss-profile (rules.json -> rule:code-review-boss-profile)
- WARNING: Missing target node: skill:code-boss-review (rules.json -> skill:code-boss-review)
- WARNING: Missing target node: skill:code-boss-review (rules.json -> skill:code-boss-review)
- WARNING: Missing target node: skill:code-boss-review (rules.json -> skill:code-boss-review)
- WARNING: Missing target node: skill:code-review (rules.json -> skill:code-review)
- WARNING: Missing target node: skill:code-review (rules.json -> skill:code-review)
- WARNING: Missing target node: skill:code-review (rules.json -> skill:code-review)
- WARNING: Missing target node: skill:code-review (rules.json -> skill:code-review)
- WARNING: Missing target node: skill:pr-review-comments (rules.json -> skill:pr-review-comments)
- WARNING: Missing target node: skill:pr-review-comments (rules.json -> skill:pr-review-comments)
- WARNING: Missing target node: skill:pr-review-comments (rules.json -> skill:pr-review-comments)
- WARNING: Missing target node: skill:pr-review-comments (rules.json -> skill:pr-review-comments)
- WARNING: Orphan candidate: schema:rules/schemas/skill-overrides.schema.json (rules/schemas/skill-overrides.schema.json -> schema:rules/schemas/skill-overrides.schema.json)
- WARNING: Orphan candidate: schema:rules/schemas/skill-workflow-result.schema.json (rules/schemas/skill-workflow-result.schema.json -> schema:rules/schemas/skill-workflow-result.schema.json)
- WARNING: Orphan candidate: script:scripts/src/deploy-skill-hook.ts (scripts/src/deploy-skill-hook.ts -> script:scripts/src/deploy-skill-hook.ts)
- WARNING: Orphan candidate: script:scripts/src/detect-context.ts (scripts/src/detect-context.ts -> script:scripts/src/detect-context.ts)
- WARNING: Orphan candidate: script:scripts/src/detect-models.ts (scripts/src/detect-models.ts -> script:scripts/src/detect-models.ts)
- WARNING: Orphan candidate: script:scripts/src/generate-agents.ts (scripts/src/generate-agents.ts -> script:scripts/src/generate-agents.ts)
- WARNING: Orphan candidate: script:scripts/src/generate-goodai-graph.ts (scripts/src/generate-goodai-graph.ts -> script:scripts/src/generate-goodai-graph.ts)
- WARNING: Orphan candidate: script:scripts/src/generate-rules-json.ts (scripts/src/generate-rules-json.ts -> script:scripts/src/generate-rules-json.ts)
- WARNING: Orphan candidate: script:scripts/src/generate-skill-registry.ts (scripts/src/generate-skill-registry.ts -> script:scripts/src/generate-skill-registry.ts)
- WARNING: Orphan candidate: script:scripts/src/goodai-graph.ts (scripts/src/goodai-graph.ts -> script:scripts/src/goodai-graph.ts)
- WARNING: Orphan candidate: script:scripts/src/shared/agents-md.ts (scripts/src/shared/agents-md.ts -> script:scripts/src/shared/agents-md.ts)
- WARNING: Orphan candidate: script:scripts/src/shared/args.ts (scripts/src/shared/args.ts -> script:scripts/src/shared/args.ts)
- WARNING: Orphan candidate: script:scripts/src/shared/checksum.ts (scripts/src/shared/checksum.ts -> script:scripts/src/shared/checksum.ts)
