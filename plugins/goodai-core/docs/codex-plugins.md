# Codex Plugin Distribution

goodai-base still supports the existing installer and sync workflow. Codex
plugins are an additional opt-in distribution path for users who want smaller
bundles instead of syncing every skill globally.

## Bundles

| Plugin | Purpose |
|---|---|
| `goodai-base` | Full monolith: all skills, rules, docs, and routing references |
| `goodai-core` | Everyday workflow, git, audit, deployment, and utility skills |
| `goodai-review` | Review orchestrator plus specialized reviewers |
| `goodai-orchestration` | Issue analysis, context collection, implementation, and verification |
| `goodai-project-docs` | PRD, gproject, and autodoc documentation workflows |

Each bundle is generated from the canonical `skills/`, `rules/`, `docs/`, and
`AGENTS.md` sources. Do not edit files under `plugins/goodai-*` by hand.

## Regenerate

```bash
cd scripts
bun run generate-codex-plugins
```

## Verify

```bash
cd scripts
bun run check-codex-plugins
bun test generate-codex-plugins
```

## Marketplace

Codex marketplace metadata lives at:

```text
.agents/plugins/marketplace.json
```

Generated plugin manifests live under:

```text
plugins/<plugin-name>/.codex-plugin/plugin.json
```

The generated bundles intentionally keep `AGENTS.md`, `rules/`, and `docs/`
inside each plugin so existing skill references continue to resolve after
installation.
