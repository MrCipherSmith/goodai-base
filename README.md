# goodai-base

A curated knowledge base of AI agent skills, coding rules, and orchestration workflows — designed to make AI assistants genuinely useful on real engineering teams.

Instead of writing the same prompts over and over, you define **skills** (reusable agent workflows) and **rules** (coding standards), sync them across your AI tools, and get consistent, high-quality output every session.

Works with Claude Code, Cursor, Codex, Zed, and OpenCode.

---

## What's inside

### 54 Skills

Structured, multi-step agent workflows across 10 categories:

| Category | Skills |
|----------|--------|
| **Analysis** | `feature-analyzer`, `issue-analyzer`, `interview`, `interviewer`, `brainstorm` |
| **Review** | `review-orchestrator`, `review-logic`, `review-architecture`, `review-security-code`, `review-performance`, `review-frontend`, `review-backend`, `review-style`, `review-clean-code`, `review-highload`, `review-greptile`, `review-strict`, `review-pr-feedback` |
| **Workflow** | `commit`, `push`, `pr`, `feature-dev`, `changelog`, `pr-issue-documenter` |
| **Orchestration** | `job-orchestrator`, `job-documenter`, `context-collector` |
| **Implementation** | `task-implementer`, `tests-creator` |
| **Project Documentation** | `gproject-orchestrator`, `gproject-discovery`, `gproject-problem-definer`, `gproject-stack-advisor`, `gproject-patterns-researcher`, `gproject-spec-writer`, `gproject-consistency-checker`, `gproject-planner`, `prd-creator` |
| **Code Documentation** | `autodoc-orchestrator`, `autodoc-scanner`, `autodoc-analyst`, `autodoc-architect`, `autodoc-writer`, `autodoc-assembler` |
| **Quality** | `security-audit`, `perf-check`, `code-verifier`, `test-gen`, `db-migrate`, `dependency-update`, `deploy` |
| **Configuration** | `hookify`, `claude-md-management` |

Notable examples:

- **`autodoc-orchestrator`** — Autonomous 5-phase reverse-engineering pipeline: scans codebase → analyzes modules in parallel → synthesizes architecture → writes docs in parallel → assembles final package. No human gates, fully autonomous. See [autodoc docs](docs/autodoc-pipeline.md)
- **`gproject-orchestrator`** — 7-phase project documentation pipeline: discovery → problem definition → stack selection → architecture → PRD → consistency review → roadmap. Decision-driven, with human gates and append-only decisions registry. See [gproject pipeline docs](docs/gproject-pipeline.md)
- **`job-orchestrator`** — Dynamic implementation orchestrator: collects context, builds an execution plan, dispatches sub-agents, tracks progress in `jobs/` with full traceability
- **`feature-analyzer`** — Deep cross-repository analysis of feature branches with architectural impact assessment
- **`issue-analyzer`** — Decomposes a GitHub issue into atomic, implementation-ready tasks for parallel agent execution
- **`task-implementer`** — Autonomous end-to-end implementation agent: reads the task, researches the codebase, writes code, verifies with lint/tests
- **`review-orchestrator`** — Routes review requests to 12 specialized subagents (logic, architecture, security, performance, frontend, backend, style, clean-code, highload, greptile, strict) and consolidates findings into one report with unified severity. See [review domain docs](docs/review-domain.md)
- **`review-greptile`** — Codebase-aware review via Greptile MCP: cross-file impact, downstream breakage, project-wide pattern violations. Free for open-source. See [Greptile integration docs](docs/greptile-integration.md)
- **`feature-dev`** — Full 7-phase feature development: requirements → design → implement → test → review → fix → PR
- **`hookify`** — Generates Claude Code / Cursor hook configs from natural language descriptions

### 29 Rules

Reference standards loaded on demand, not always-on:

| Area | Rules |
|------|-------|
| **Code Review** | `code-review-ai-assistant`, `code-review-boss-profile` |
| **TypeScript / React** | `code-style-patterns`, `frontend-assistant` |
| **Backend** | `nestjs-dto` |
| **State** | `mobx-store-template` |
| **Testing** | `playwright-testing`, `storybook-guidelines` |
| **Git** | `commit-message-formatting`, `git-rules` |
| **Planning** | `implementation-plans`, `requirements-management` |
| **AI / Meta** | `model-selection`, `rule-management-workflow`, `skills-storage-workflow` |
| **Documentation** | `documentation-management`, `jobs-documentation` |

---

## Quick start

**One-line install (recommended):**

```bash
curl -fsSL https://raw.githubusercontent.com/MrCipherSmith/goodai-base/main/install.sh | bash
```

The installer clones the repo, installs dependencies, and launches an interactive setup wizard. The wizard:

1. **AI tools** — choose which tools to sync (Claude Code, Cursor, Codex, OpenCode, Zed)
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

Each skill lives in `skills/<name>/` and has platform-specific definitions:

```
skills/feature-analyzer/
├── SKILL.md          # Claude Code
├── SKILL.cursor.md   # Cursor
├── SKILL.codex.md    # Codex
├── SKILL.zed.md      # Zed
└── SKILL.opencode.md # OpenCode
```

Skills are invoked by name inside your AI tool session. In Claude Code, for example:

```
/feature-analyzer
/code-review
/job-orchestrator
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
├── skills/                # Skill definitions (54 skills, multi-platform)
│   └── shared/            # Shared prompts reused across skills
├── plugins/               # Generated Codex plugin bundles
├── .agents/plugins/       # Codex marketplace metadata
├── scripts/               # Sync, generation, and validation utilities
├── docs/                  # Auto-generated catalogs (skill-catalog.md, rules-catalog.md)
└── jobs/                  # Per-session job documentation (gitignored)
```

---

## CI

A GitHub Actions workflow auto-regenerates `docs/skill-catalog.md` and `docs/rules-catalog.md` on every push to `main` that touches `skills/` or `rules/`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE).
