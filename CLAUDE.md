# CLAUDE.md — goodai-base

This is the **knowledge base repo** for AI agent skills and rules. It is not a product codebase — it is a library of reusable agent behaviors consumed by all other projects via the global `~/.claude/CLAUDE.md`.

---

## What This Repo Is

- **`skills/`** — Actionable agent workflows (job-orchestrator, task-implementer, code-review, etc.)
- **`rules/core/`** — Coding standards and guidelines (TDD, SOLID, git conventions, etc.)
- **`docs/`** — Human-readable documentation for agents and the ecosystem
- **`scripts/`** — TypeScript/Bun scripts for catalog generation and validation
- **`AGENTS.md`** — The routing table: maps user intent to the right skill or rule

## How Other Projects Use This Repo

Every project's Claude session starts by reading `~/goodai-base/AGENTS.md` (via global `~/.claude/CLAUDE.md`). Claude then reads only the specific skill or rule file that matches the user's request. **Skills are invoked with the `Skill` tool, not by manually following SKILL.md steps.**

## graphify

- For code-structure, relationship, ownership, lifecycle, or impact questions, if `graphify-out/graph.json` exists, use graphify before broad grep or raw file browsing.
- Resolve the CLI with `command -v graphify`; if it is missing and `$HOME/.local/bin/graphify` exists, use `$HOME/.local/bin/graphify`.
- Use `graphify query "<question>"` for broad codebase questions, `graphify path "<A>" "<B>"` for relationships, `graphify explain "<symbol>"` for local neighborhood, and `graphify affected "<symbol>"` for blast radius.
- During code review, run graphify for changed exported classes, stores, API wrappers, services, adapters, components, managers, core exports, flow nodes, and shared utilities when the graph is available.
- Review outputs must record graph usage as `graph_context: used` with queries run, or `graph_context: unavailable` with `missing_graph`, `missing_cli`, or `query_failed`.
- Treat graph results as navigation only; verify every assertion and review finding against the actual code.
- If a backend graph MCP server is available, use the exact tools `mcp__backend_graph.query_graph`, `mcp__backend_graph.get_neighbors`, `mcp__backend_graph.shortest_path`, `mcp__backend_graph.get_pr_impact`, and `mcp__backend_graph.god_nodes` for backend and cross-repo questions.

---

## Working in This Repo

### Adding or editing a skill

1. Edit `skills/<skill-name>/SKILL.md`
2. Update `AGENTS.md` if the skill's routing entry changes
3. Run `cd scripts && bun run generate-agents` to regenerate `AGENTS.mdc`
4. Update `CHANGELOG.md` with the version bump

### Adding or editing a rule

1. Edit or create `rules/core/<rule-name>.mdc`
2. Run `cd scripts && bun run generate-rules-json` to regenerate `rules.json`
3. Update `AGENTS.md` Core Rule Catalog section if needed

### Setup wizard

The setup wizard (`setup.ts`) configures artifact paths, sub-agent model, TDD mode, and doc languages. Run it from the repo root:

```bash
bun setup.ts                  # first-time setup
bun setup.ts --reconfigure    # re-run over existing config
```

Preferences are saved to `goodai.config.json` and written as env vars to `~/.zshrc` / `~/.bashrc`.

### Running scripts

All scripts are TypeScript, run with Bun from the `scripts/` directory:

```bash
cd scripts
bun test                           # run all 244 tests
bun run sync-skills                # sync skill catalog
bun run generate-agents            # regenerate AGENTS.mdc from AGENTS.md
bun run generate-rules-json        # regenerate rules.json
bun run validate-skills-before-sync  # validate all SKILL.md files
```

### Running the full sync

```bash
cd scripts && bun run sync-agents && bun run generate-rules-json
```

---

## Key Conventions

### Skill versioning

Every `SKILL.md` has a `version:` field in frontmatter. Bump it when behavior changes:
- Patch (`1.0.x`) — wording/clarification only
- Minor (`1.x.0`) — new phases or changed workflow
- Major (`x.0.0`) — breaking change to input/output contract

### Artifact paths (JOBS_ROOT and DOCS_ROOT)

Both follow the same resolution order:
1. Value passed explicitly by the orchestrator in the dispatch prompt
2. `GOODAI_JOBS_ROOT` / `GOODAI_DOCS_ROOT` environment variable (if set)
3. `<PROJECT_DIR>/jobs/` or `<PROJECT_DIR>/docs/` — default

Sub-agents never resolve these themselves — they receive the resolved path from the orchestrator.

### STATUS protocol

Every sub-agent response must start with:
```
STATUS: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
```

### Skill descriptions

All `description:` fields must be trigger conditions ("Use when X"), not workflow summaries.

---

## What NOT to Do Here

- Do not hardcode `~/goodai-base/jobs/` or `~/goodai-base/docs/` — use `<JOBS_ROOT>` / `<DOCS_ROOT>`
- Do not manually execute SKILL.md steps — use the `Skill` tool
- Do not add project-specific code here (this repo is shared across all projects)
- Do not commit `goodai.config.json` with personal paths — it is gitignored
- Do not commit large binaries or generated `node_modules/` (already gitignored)
