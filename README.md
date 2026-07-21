# goodai-base

A curated knowledge base of AI agent skills, coding rules, and orchestration workflows — designed to make AI assistants genuinely useful on real engineering teams.

Instead of writing the same prompts over and over, you define **skills** (reusable agent workflows) and **rules** (coding standards), sync them across your AI tools, and get consistent, high-quality output every session.

Works with Claude Code, Cursor, Codex, Zed, OpenCode, ZCode, and **Grok** (via Claude/Cursor skill discovery — see [onboarding](docs/onboarding.md#grok-integration)).

---

## What's inside

### 70 Skills

Structured multi-step agent workflows. Full table: [docs/skill-catalog.md](docs/skill-catalog.md). Highlights by category:

| Category | Skills (examples) |
|----------|-------------------|
| **Analysis** | `feature-analyzer`, `issue-analyzer`, `interview`, `interviewer`, `brainstorm`, `plan-gatekeeper` |
| **Review** | `review-orchestrator` + specialized reviewers (`review-logic`, `review-architecture`, `review-security-code`, `review-frontend`, `review-backend`, `review-highload`, `review-greptile`, …), legacy profiles (`code-ai-review`, `code-boss-review`, …) |
| **Workflow** | `commit`, `push`, `pr`, `feature-dev`, `changelog`, `pr-issue-documenter`, `pr-review-comments` |
| **Orchestration** | `job-orchestrator`, `job-documenter`, `context-collector`, `code-verifier` |
| **Implementation** | `task-implementer`, `tests-creator` |
| **Pre-impl specs** | `spec-orchestrator`, `brd-creator`, `prd-creator`, `fsd-creator`, `trd-creator` |
| **Project Documentation** | `gproject-orchestrator` + phase subagents (`gproject-discovery` … `gproject-planner`) |
| **Code Documentation** | `autodoc-orchestrator` + phase subagents (`autodoc-scanner` … `autodoc-assembler`) |
| **Quality / Ops** | `security-audit`, `perf-check`, `test-gen`, `db-migrate`, `dependency-update`, `deploy` |
| **Configuration / UX** | `hookify`, `claude-md-management`, `caveman-mode` |

Notable examples:

- **`autodoc-orchestrator`** — Autonomous reverse-engineering docs pipeline. See [autodoc docs](docs/autodoc-pipeline.md)
- **`gproject-orchestrator`** — 7-phase project documentation (discovery → roadmap). See [gproject docs](docs/gproject-pipeline.md)
- **`spec-orchestrator`** — Pre-implementation suite BRD → PRD → FSD → TRD with review loops
- **`job-orchestrator`** — Implementation orchestrator with wave isolation, TDD, and `jobs/` traceability
- **`plan-gatekeeper`** — Interactive design gatekeeper: stress-tests plans and produces ADRs
- **`review-orchestrator`** — Routes to specialized reviewers and consolidates severity. See [review domain](docs/review-domain.md)
- **`feature-dev`** — Guided feature development through implement → verify → PR
- **`caveman-mode`** — Session-level terse responses (`/caveman`) to cut token noise

### ~30 Rules

Reference standards loaded on demand (see [docs/rules-catalog.md](docs/rules-catalog.md)):

| Area | Examples |
|------|----------|
| **Code Review** | `code-review-ai-assistant`, `code-review-boss-profile` |
| **TypeScript / React** | `code-style-patterns`, `frontend-assistant` |
| **Backend / State** | `nestjs-dto`, `mobx-store-template` |
| **Testing** | `playwright-testing`, `storybook-guidelines`, `tdd-workflow` |
| **Git** | `commit-message-formatting`, `git-rules` |
| **Planning** | `implementation-plans`, `requirements-management`, `requirements-package-standard` |
| **Engineering** | `solid-principles`, `error-handling`, `clean-architecture`, `security-baseline`, … |
| **AI / Meta** | `model-selection`, `skills-storage-workflow`, `subagent-status-protocol` |
| **Documentation** | `documentation-management`, `jobs-documentation` |

---

## Quick start

**One-line install (recommended):**

```bash
curl -fsSL https://raw.githubusercontent.com/MrCipherSmith/goodai-base/main/install.sh | bash
```

The installer clones the repo, installs dependencies, and launches an interactive setup wizard. The wizard:

1. **AI tools** — choose which tools to sync (Claude Code, Cursor, Codex, OpenCode, Zed, ZCode). ZCode is installed as a plugin (generated + dropped into `~/.zcode/cli/plugins/`).
2. **Global config** — injects goodai-base routing block into each tool's global instructions file
3. **Artifact paths** — optionally set `GOODAI_JOBS_ROOT` / `GOODAI_DOCS_ROOT` env vars
4. **Sub-agent model** — sonnet / opus / haiku
5. **TDD enforcement** — strict Iron Laws / relaxed for fix tasks
6. **Languages** — ru+en+ai / en+ai / en

**Manual install:**

```bash
git clone https://github.com/MrCipherSmith/goodai-base.git ~/goodai-base
cd ~/goodai-base/scripts && bun install
bun ~/goodai-base/setup.ts    # run setup wizard
```

**Re-configure at any time:**

```bash
bun ~/goodai-base/setup.ts --reconfigure
```

**Sync only (after initial setup):**

```bash
cd ~/goodai-base/scripts
bun run sync-skills                    # sync to tools from goodai.config.json
bun src/sync-skills.ts --tools claude,cursor  # sync to specific tools
bun src/sync-skills.ts --all           # force all tools
```

Skills and `AGENTS.md` are synced to each tool's directory. Global config (routing instructions) is injected separately by the wizard:

| Tool | Skills synced to | Global config |
|------|-----------------|---------------|
| Claude Code | `~/.claude/skills/` | `~/.claude/CLAUDE.md` |
| Cursor | `~/.cursor/skills/` | `~/.cursor/rules/goodai-base.mdc` |
| Codex | `~/.codex/skills/` | `~/.codex/AGENTS.md` (auto-synced) |
| Zed | `~/.config/zed/skills/` | `~/.config/zed/AGENTS.md` (auto-synced) |
| OpenCode | `~/.config/opencode/skills/` | `~/.config/opencode/AGENTS.md` (auto-synced) |

### Codex plugins

Codex users can also install opt-in plugin bundles instead of syncing every
skill globally. The generated marketplace exposes:

- `goodai-base` — all skills and rules in one plugin
- `goodai-core` — everyday workflow, git, audit, deployment, and utility skills
- `goodai-review` — review orchestrator and specialized reviewers
- `goodai-orchestration` — issue analysis, implementation, and verification
- `goodai-project-docs` — PRD, gproject, and autodoc workflows

See [Codex Plugin Distribution](docs/codex-plugins.md) for generation,
verification, and marketplace details.

---

## How it works

### Skills

Each skill lives in `skills/<name>/`. **Canonical source is always `SKILL.md`.**

Platform variants (`SKILL.cursor.md`, `SKILL.codex.md`, …) are **optional** — create them only when content must differ. `sync-skills` falls back to `SKILL.md` for every tool (strategy A).

```
skills/feature-analyzer/
├── SKILL.md            # required (canonical)
├── SKILL.cursor.md     # optional override for Cursor
├── SKILL.codex.md      # optional override for Codex
└── …
```

Pre-sync gate: `cd scripts && bun run validate-skills-before-sync` (requires valid `SKILL.md` only).

Skills are invoked by name inside your AI tool session. In Claude Code, for example:

```
/feature-analyzer
/code-review
/job-orchestrator
/plan-gatekeeper
```

### Rules

Rules live in `rules/core/*.mdc` and are loaded on demand via `AGENTS.md`. They are not injected into every context — the agent selects the right rule when the user's request matches.

### AGENTS.md

The single always-on file that acts as a routing table. It tells the agent:
- Which skill to invoke for which type of request
- Which rule file to load for coding standards
- When to ask the user before dispatching (orchestrator vs. direct skill)

---

## Project structure

```
.
├── AGENTS.md              # Routing table — always loaded by the AI tool
├── AGENTS.mdc             # Same with YAML frontmatter (for Cursor alwaysApply)
├── rules/
│   └── core/              # Coding standards, git rules, review profiles (.mdc)
├── skills/                # Skill definitions (~70 skills; SKILL.md required)
│   └── shared/            # Shared prompts reused across skills
├── plugins/               # Generated Codex / ZCode plugin bundles
├── .agents/plugins/       # Codex marketplace metadata
├── scripts/               # Sync, generation, and validation utilities
├── docs/                  # Catalogs, onboarding, pipeline docs, requirements packages
├── .metaproject/          # Optional Keryx metaproject (graph, wiki, flows) when initialized
└── jobs/                  # Per-session job documentation (often gitignored)
```

---

## Docs

| Doc | Description |
|-----|-------------|
| [docs/onboarding.md](docs/onboarding.md) | How skills/rules load, sync, **Grok integration** |
| [docs/skill-catalog.md](docs/skill-catalog.md) | Auto-generated list of all skills |
| [docs/rules-catalog.md](docs/rules-catalog.md) | Auto-generated list of all rules |
| [docs/skills-overview.md](docs/skills-overview.md) | Ecosystem map and skill interactions |
| [docs/review-domain.md](docs/review-domain.md) | Review orchestrator domain |
| [docs/gproject-pipeline.md](docs/gproject-pipeline.md) | gproject documentation pipeline |
| [docs/autodoc-pipeline.md](docs/autodoc-pipeline.md) | autodoc reverse-engineering pipeline |
| [docs/requirements/](docs/requirements/) | Requirements packages (e.g. skill profiles + Grok) |
| [scripts/README.md](scripts/README.md) | Sync/validation CLI reference |

---

## CI

A GitHub Actions workflow auto-regenerates `docs/skill-catalog.md` and `docs/rules-catalog.md` on every push to `main` that touches `skills/` or `rules/`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Platform skill files are optional — only add when content differs from `SKILL.md`.

---

## License

MIT — see [LICENSE](LICENSE).
