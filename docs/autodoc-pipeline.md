# autodoc — Code Documentation Pipeline

> Autonomous reverse-engineering pipeline that takes an existing codebase and produces comprehensive developer documentation — fully without human intervention after the initial project path is provided.

## Why autodoc

Writing documentation for existing code is time-consuming and often skipped. `autodoc` automates the entire process:

- Scans the project structure and detects modules automatically
- Runs parallel analysis agents — one per module — to deeply understand the codebase
- Synthesizes a system-level architecture view from all module analyses
- Writes all documentation sections in parallel
- Assembles the final documentation package

The pipeline requires no human decisions or approvals — it runs to completion autonomously.

---

## Pipeline Overview

```
Phase 0  Interview (if needed)    → collect project path + scope
Phase 1  autodoc-scanner          → artifacts/project-map.md
Phase 2  autodoc-analyst × N      → artifacts/analysis/<module>.md  [parallel]
Phase 3  autodoc-architect        → artifacts/architecture.md
Phase 4  autodoc-writer × N       → docs/<section>.md               [parallel]
Phase 5  autodoc-assembler        → docs/README.md + docs/index.md
```

Phases 2 and 4 run parallel agents — one per detected module and one per documentation section respectively.

---

## How to Start

Simply say **"autodoc"** or provide a project path:

```
"autodoc /path/to/my/project"
"Generate documentation for /home/user/myapp"
"автодок /path/to/project"
```

If no path is provided, the orchestrator asks minimal questions before starting:
1. Project directory path
2. Scope (full project / backend only / frontend only / custom path)
3. Output language (English / Russian / both)
4. Existing docs to incorporate (optional)

---

## Phase Details

### Phase 0 — Interview (conditional)

Only runs if the project path is not provided upfront. Asks maximum 4 questions, always with options. Saves config to `state.json`.

---

### Phase 1 — Project Scanning (`autodoc-scanner`)

**Input:** Project directory path  
**Output:** `artifacts/project-map.md`

The scanner reads:
- Directory structure (2-3 levels)
- Build/package files (`package.json`, `go.mod`, `pyproject.toml`, etc.)
- Workspace configs (`nx.json`, `turbo.json`, `pnpm-workspace.yaml`)
- Docker and CI configuration

It detects:
- **Module boundaries**: monorepo packages, feature modules, service directories
- **Stack per module**: language, framework, version
- **Entry points**: main files, app bootstraps, route definitions
- **API signals**: OpenAPI/Swagger files, `.proto` files, router definitions
- **Schema signals**: Prisma schema, migration directories, model files

The scanner's `next_phase_hints.modules[]` array drives how many parallel analysts launch in Phase 2.

---

### Phase 2 — Deep Analysis (`autodoc-analyst` × N) — Parallel

**Input:** Module path + project-map  
**Output:** `artifacts/analysis/<module>.md` per module

One agent is launched **per detected module**, all running simultaneously.

Each analyst:
1. Reads the module's entry point and directory structure
2. Extracts the public API surface (endpoints, exports, components, hooks)
3. Identifies architectural patterns (DI, CQRS, Repository, MobX, Redux, etc.)
4. Maps external dependencies (databases, queues, auth providers)
5. Notes cross-module dependencies

Example outputs:
- `artifacts/analysis/backend.md` — NestJS modules, controllers, services, DTOs
- `artifacts/analysis/frontend.md` — React components, pages, hooks, stores
- `artifacts/analysis/shared.md` — shared types, utilities, constants

---

### Phase 3 — Architecture Synthesis (`autodoc-architect`)

**Input:** All `artifacts/analysis/*.md` + `project-map.md`  
**Output:** `artifacts/architecture.md`

Reads all module analyses and synthesizes the system-level view:
- Identifies the dominant architectural style (monolith, microservices, modular monolith, hexagonal, etc.)
- Maps cross-module integration topology (which modules talk to which, via what protocol)
- Traces the main request flow through the system
- Extracts cross-cutting concerns: auth, logging, error handling, caching, config management
- Identifies key data stores and their roles

---

### Phase 4 — Documentation Writing (`autodoc-writer` × N) — Parallel

**Input:** Architecture artifact + all analysis artifacts  
**Output:** One `docs/<section>.md` per writer

One writer is launched **per documentation section**, all running simultaneously.

Standard sections:

| Section | File | Always? |
|---------|------|---------|
| Getting Started | `docs/onboarding.md` | Yes |
| Architecture Overview | `docs/architecture.md` | Yes |
| Module Reference | `docs/modules.md` | Yes |
| API Reference | `docs/api-reference.md` | Only if APIs detected |
| Data Models | `docs/data-models.md` | Only if schemas detected |

Each writer uses the analysis artifacts as the only source of truth. If information is missing from the artifacts, it marks the gap as `[TODO: add X]` rather than inventing content.

---

### Phase 5 — Assembly (`autodoc-assembler`)

**Input:** All `docs/*.md`  
**Output:** `docs/README.md` + `docs/index.md`

The assembler:
1. Reads all generated sections
2. Collects any `[TODO: ...]` markers from writers (reported as concerns)
3. Writes `docs/README.md` — the main entry point with project overview, quick start, and navigation table
4. Writes `docs/index.md` — navigation index with links to all sections

---

## Output Structure

```
jobs/autodoc-<project>/
├── state.json                    # Pipeline state + phase summaries
├── artifacts/
│   ├── project-map.md            # Phase 1 — structural scan
│   └── analysis/                 # Phase 2 — module analyses
│       ├── backend.md
│       ├── frontend.md
│       └── <module>.md
├── docs/                         # Final documentation (Phase 4-5)
│   ├── README.md                 # Main entry point
│   ├── index.md                  # Navigation index
│   ├── onboarding.md             # Setup + dev workflow
│   ├── architecture.md           # System architecture
│   ├── modules.md                # Module reference
│   ├── api-reference.md          # API contracts (if applicable)
│   └── data-models.md            # Data schemas (if applicable)
└── ai/
    └── context.md                # Internal context snapshot
```

---

## Supported Project Types

| Type | Detection | Notes |
|------|-----------|-------|
| Node.js monorepo | `nx.json`, `turbo.json`, `pnpm-workspace.yaml` | Each workspace package = module |
| NestJS backend | `@nestjs/core` in deps | Full module/controller/service analysis |
| Next.js frontend | `next` in deps | Pages, components, API routes |
| React SPA | `react` in deps (no Next) | Components, hooks, state |
| Python FastAPI | `fastapi` in pyproject | Routes, schemas, dependencies |
| Go service | `go.mod` present | Packages, handlers, models |
| Rust service | `Cargo.toml` present | Crates, modules |
| Any REST API | OpenAPI/Swagger files | Full endpoint extraction |
| gRPC service | `*.proto` files | Service + message definitions |
| GraphQL service | `*.graphql` + resolvers | Schema + resolvers |

---

## State Resumption

Pipeline state is saved to `jobs/autodoc-<name>/state.json`. If a session is interrupted:

```
Found interrupted autodoc job: autodoc-myapp at Phase 2
A) Resume from Phase 2
B) Start fresh
C) Show current state
```

---

## Iron Laws

| # | Law |
|---|-----|
| 1 | Orchestrator NEVER reads code or writes docs — only subagents do |
| 2 | Phase 2 analysts MUST run in parallel — one per module |
| 3 | Phase 4 writers MUST run in parallel — one per section |
| 4 | All content must be derived from artifacts — no hallucination |
| 5 | Missing info is marked `[TODO: ...]`, never invented |
| 6 | No human gates — pipeline runs to completion autonomously |

---

## vs gproject-orchestrator

| | `autodoc` | `gproject` |
|-|-----------|-----------|
| Direction | Code → Documentation | Idea → Spec |
| Input | Existing codebase | User's project idea |
| Output | Developer docs (onboarding, arch, API ref) | PRD + roadmap |
| Human gates | None | 3 mandatory gates |
| Parallelism | High (Phases 2 + 4) | Low (sequential phases) |
| Use when | Existing project needs documentation | New project needs planning |

---

## Routing

- **"autodoc"** or **"автодок"** → `autodoc-orchestrator` directly
- **"Document this codebase"** → `autodoc-orchestrator`
- **"Plan a new feature"** → `gproject-orchestrator` (not autodoc)
- **"Review my code"** → `code-review` (not autodoc)

See also: [AGENTS.md § Code Documentation Skills](../AGENTS.md)
