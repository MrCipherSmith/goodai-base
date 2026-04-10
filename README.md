# goodai-base

A curated knowledge base of AI agent skills, coding rules, and orchestration workflows — designed to make AI assistants genuinely useful on real engineering teams.

Instead of writing the same prompts over and over, you define **skills** (reusable agent workflows) and **rules** (coding standards), sync them across your AI tools, and get consistent, high-quality output every session.

Works with Claude Code, Cursor, Codex, Zed, and OpenCode.

---

## What's inside

### 30 Skills

Structured, multi-step agent workflows across 8 categories:

| Category | Skills |
|----------|--------|
| **Analysis** | `feature-analyzer`, `issue-analyzer`, `pr-review-comments`, `interview`, `interviewer` |
| **Review** | `code-review`, `code-ai-review`, `code-boss-review`, `code-style-review`, `code-mobx-store-review` |
| **Workflow** | `commit`, `push`, `pr`, `feature-dev`, `changelog` |
| **Orchestration** | `job-orchestrator`, `job-documenter`, `context-collector` |
| **Implementation** | `task-implementer` |
| **Planning** | `prd-creator` |
| **Quality** | `security-audit`, `perf-check`, `test-gen`, `db-migrate`, `dependency-update`, `deploy` |
| **Configuration** | `hookify`, `claude-md-management` |

Notable examples:

- **`job-orchestrator`** — Dynamic orchestrator: collects context, builds an execution plan, dispatches sub-agents, tracks progress in `jobs/` with full traceability
- **`feature-analyzer`** — Deep cross-repository analysis of feature branches with architectural impact assessment
- **`issue-analyzer`** — Decomposes a GitHub issue into atomic, implementation-ready tasks for parallel agent execution
- **`task-implementer`** — Autonomous end-to-end implementation agent: reads the task, researches the codebase, writes code, verifies with lint/tests
- **`code-review`** — 4 parallel review agents: correctness, security, performance, style — consolidated into one report
- **`feature-dev`** — Full 7-phase feature development: requirements → design → implement → test → review → fix → PR
- **`hookify`** — Generates Claude Code / Cursor hook configs from natural language descriptions

### 17 Rules

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

```bash
git clone https://github.com/MrCipherSmith/goodai-base.git ~/goodai-base
cd ~/goodai-base
chmod +x scripts/*.sh
./scripts/sync-skills.sh
```

The sync script copies skills and the `AGENTS.md` routing table to all configured AI tools:

| Tool | Target |
|------|--------|
| Claude Code | `~/.claude/` |
| Cursor | `~/.cursor/skills/` |
| Codex | `~/.codex/skills/` |
| Zed | `~/.config/zed/skills/` |
| OpenCode | `~/.config/opencode/skills/` |

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
├── skills/                # Skill definitions (30 skills, multi-platform)
│   └── shared/            # Shared prompts reused across skills
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
