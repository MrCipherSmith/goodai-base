# PRD: GoodAI Graph

## 1. Обзор

GoodAI Graph - это typed knowledge graph для `goodai-base`, который помогает агенту выбирать skills и rules не только по keywords, но и по явным graph relations между intent, skill, rule, schema, plugin и workflow. Impact analysis и CI-валидация остаются supporting capabilities, но основной продуктовый результат - более точный graph-aware routing.

## 2. Контекст

Product: `goodai-base`

Module: routing, skill/rule selection, validation, plugin generation

User Role: maintainers of goodai-base, AI coding assistants, contributors

Tech Stack: TypeScript/Bun scripts, Markdown skills/rules, JSON Schema, Codex plugin bundles

## 3. Проблема

Сейчас выбор skill/rule в `goodai-base` в основном зависит от ручного routing table и keywords в `AGENTS.md` / `rules.json`. Это плохо масштабируется: похожие запросы могут требовать разных skills, один skill может зависеть от конкретных rules/schemas, а новые skills нужно вручную протаскивать через routing descriptions. Важные связи распределены по Markdown, JSON, schemas, plugin generator scripts и документации, поэтому агент не видит dependency graph при выборе действия.

## 4. Цели

- Создать machine-readable graph artifact для основных сущностей `goodai-base`.
- Использовать graph relations как input для выбора skills и rules.
- Дать агенту explainable routing: почему выбран skill/rule и какие зависимости подтянуты.
- Валидировать критичные связи между skills, rules, schemas, plugins и scripts.
- Дать maintainers быстрые команды для impact analysis и поиска missing/orphan dependencies.
- Генерировать человекочитаемый отчет по графу для review и onboarding.

## 5. Не-цели

- Не создавать полный аналог Graphify.
- Не индексировать весь исходный код как AST graph на первом этапе.
- Не удалять `AGENTS.md` и `rules.json` в первой итерации.
- Не добавлять внешний runtime database вроде Neo4j.
- Не отправлять содержимое репозитория во внешние LLM API.
- Не индексировать `jobs/` по умолчанию, потому что это session artifacts.

## 6. Функциональные требования

FR-1: Система должна генерировать `docs/goodai-graph.json` из canonical repo sources.

FR-2: Graph должен включать nodes минимум для типов: `skill`, `rule`, `schema`, `plugin`, `script`, `doc`.

FR-3: Graph должен включать edges минимум для типов: `loads_rule`, `uses_schema`, `dispatches_skill`, `bundled_in_plugin`, `generated_by_script`, `documents`.

FR-4: Generator должен читать skill frontmatter, known schema references, plugin bundle definitions and existing catalog artifacts without requiring network access.

FR-5: Validator должен обнаруживать missing references: отсутствующие rules, schemas, skills и plugin paths.

FR-6: Validator должен обнаруживать orphaned graph nodes, которые не доступны из основных entrypoints, но не должен автоматически считать их ошибкой без классификации.

FR-7: Система должна предоставлять routing resolver, который принимает user intent и возвращает ranked candidates для skills/rules с объяснением выбора.

FR-8: Routing resolver должен учитывать минимум: keyword match, explicit triggers, graph distance от intent concepts, dependency completeness, plugin availability и historical/manual priority if present.

FR-9: Routing resolver должен возвращать не только выбранный skill/rule, но и required supporting artifacts: rules, schemas, references, related skills.

FR-10: Routing resolver должен поддерживать dry-run/explain режим, чтобы агент мог показать, почему выбран конкретный skill/rule.

FR-11: CLI должен поддерживать команды:

```bash
bun src/generate-goodai-graph.ts
bun src/validate-goodai-graph.ts
bun src/goodai-graph.ts route "<user request>"
bun src/goodai-graph.ts impact <path-or-id>
bun src/goodai-graph.ts why <node-id>
```

FR-12: Report generator должен создавать `docs/goodai-graph.md` с summary, routing coverage, node counts, edge counts, missing references, orphan candidates и high-impact nodes.

FR-13: Generated graph должен быть deterministic: одинаковый input дает одинаковый JSON ordering.

FR-14: CI/check mode должен завершаться с non-zero exit code при missing required dependencies.

## 7. Нефункциональные требования

NFR-1: Generator должен работать локально без сети.

NFR-2: Для текущего размера `goodai-base` генерация должна занимать менее 5 секунд на обычной developer machine.

NFR-3: Формат graph JSON должен быть stable и версионирован через поле `schema_version`.

NFR-4: Код должен использовать существующие TypeScript/Bun patterns из `scripts/src`.

NFR-5: Ошибки validator должны быть actionable: указывать source file, missing target и suggested fix.

NFR-6: Generated Markdown должен быть пригоден для review в PR.

## 8. Ограничения

- Source of truth на первой итерации остается существующим: `skills/`, `rules/`, `plugins/`, `scripts/`, `AGENTS.md`, `rules.json`.
- Новый graph не должен ломать существующие sync/generate workflows.
- Нельзя добавлять тяжелую зависимость, если достаточно стандартного TypeScript parser/regex для Markdown frontmatter и JSON.
- Нельзя автоматически переписывать `AGENTS.md` на основе графа в первой итерации; вместо этого resolver должен работать рядом с существующим routing.
- `jobs/` должен быть исключен из default graph scope.

## 9. Edge Cases

- Skill существует только в platform-specific варианте, но не имеет canonical `SKILL.md`.
- Skill references schema by relative path and by bare filename.
- Rule exists on disk, but is missing from `AGENTS.md` catalog.
- Plugin bundle includes a skill, but misses required shared files.
- Generated plugin copy contains stale content compared to canonical source.
- Markdown mentions a skill name in prose, but this is not a real dependency.
- Node id collision between skill and rule with same name.

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

## 11. Проверка

- Run unit tests for graph parsing, id generation, edge extraction, routing ranking and validator failures.
- Run generator on the repository and review `docs/goodai-graph.json`.
- Run validator in success mode on the current repository.
- Run resolver fixtures for explicit skill names, ambiguous review requests, standards/rules requests and unsupported intents.
- Add at least one fixture-based test for a missing dependency.
- Run existing script validation that is relevant to generated catalogs and plugin bundles.
