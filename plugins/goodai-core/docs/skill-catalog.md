# Skill Catalog

_Auto-generated from `skills/*/SKILL.md`. Do not edit manually._

Total: 54 skills

| Name | Description | Version | Category |
| ---- | ----------- | ------- | -------- |
| `autodoc-analyst` | Phase 2 subagent for autodoc-orchestrator. Deep-dives into a single module to extract purpose, st... | — | — |
| `autodoc-architect` | Phase 3 subagent for autodoc-orchestrator. Synthesizes all module analyses into a system-level ar... | — | — |
| `autodoc-assembler` | Phase 5 subagent for autodoc-orchestrator. Assembles all documentation sections into a cohesive p... | — | — |
| `autodoc-orchestrator` | Autonomous reverse-engineering documentation pipeline — scans an existing codebase and produces c... | — | — |
| `autodoc-scanner` | Phase 1 subagent for autodoc-orchestrator. Scans project structure, detects stack, identifies mod... | — | — |
| `autodoc-writer` | Phase 4 subagent for autodoc-orchestrator. Writes one documentation section from analysis artifac... | — | — |
| `brainstorm` | Use when exploring architecture decisions, tech choices, feature ideas, or any open-ended problem... | 1.0.0 | ideation |
| `changelog` | Use when generating a changelog, release notes, or summarizing what changed between tags, version... | 1.0.0 | workflow |
| `claude-md-management` | Use when saving session learnings, coding patterns, conventions, or commands discovered during wo... | 1.0.0 | configuration |
| `code-verifier` | Use when running a full quality gate after implementation — lint, type-check, tests, and import v... | 1.0.0 | verification |
| `commit` | Use when committing code changes and a well-structured conventional commit message is needed, wit... | 1.0.0 | workflow |
| `context-collector` | Use when a job needs a unified context document — gathering docs, libraries, and references for s... | 1.1.0 | context |
| `db-migrate` | Use when creating, applying, rolling back, or checking the status of database migrations. | 1.0.0 | database |
| `dependency-update` | Use when checking for outdated packages or upgrading dependencies with compatibility verification. | 1.0.0 | maintenance |
| `deploy` | Use when deploying to any environment (staging, production) or when a deployment pipeline needs t... | 1.0.0 | ops |
| `feature-analyzer` | Use when analyzing feature branch changes across repos, planning implementation, or understanding... | 2.4.0 | analysis |
| `feature-dev` | Use when taking a feature from idea or GitHub issue all the way to a merge-ready PR in one guided... | 2.0.0 | workflow |
| `gproject-consistency-checker` | Validates PRD/Implementation Plan against decisions registry, architecture doc, and best practice... | — | — |
| `gproject-discovery` | Collects and structures initial project information from multiple sources. Use when: dispatched b... | — | — |
| `gproject-orchestrator` | Project documentation orchestrator — builds PRDs, specs, and implementation plans through a phase... | — | — |
| `gproject-patterns-researcher` | Researches best practices per technology in the chosen stack and defines application architecture... | — | — |
| `gproject-planner` | Generates roadmap, milestones, task breakdown, and dependency graph from PRD. Use when: dispatche... | — | — |
| `gproject-problem-definer` | Defines core problems, goals, non-goals, and success metrics from discovery data. Use when: dispa... | — | — |
| `gproject-spec-writer` | Generates PRD or Implementation Plan constrained by decisions registry, architecture doc, and bes... | — | — |
| `gproject-stack-advisor` | Determines project level (MVP/pet/startup/production) and recommends optimal technology stack wit... | — | — |
| `hookify` | Use when adding automated hook behavior to Claude Code or Cursor from a natural language descript... | 1.0.0 | configuration |
| `iago` | Use when generating or updating a Mermaid diagram for a GitHub pull request review, especially af... | 1.0.0 | review |
| `interview` | Use before implementation, design, or migration when requirements are unclear and targeted clarif... | 1.0.0 | analysis |
| `interviewer` | Use when requirements are ambiguous and precise clarification is needed before proceeding with a ... | 1.0.0 | meta |
| `issue-analyzer` | Use when decomposing a GitHub issue into atomic tasks for AI implementation, planning task breakd... | 1.1.0 | analysis |
| `job-documenter` | Use when a job folder needs to be initialized, or analysis/report/review documents need to be cre... | 1.0.0 | documentation |
| `job-orchestrator` | Use when a GitHub issue or complex intent needs to be analyzed, planned, and implemented end-to-e... | 3.2.0 | orchestration |
| `perf-check` | Use when measuring bundle size, detecting performance regressions, auditing slow queries, or inve... | 1.0.0 | performance |
| `pr` | Use when opening a pull request for the current branch. | 1.0.0 | workflow |
| `pr-issue-documenter` | Use when documenting PR changes, adding a PR description, creating a linked issue for a PR, or up... | 1.0.0 | documentation |
| `prd-creator` | Use when a vague or unstructured request needs to be converted into a formal, testable Product Re... | 1.0.0 | planning |
| `push` | Use when pushing the current branch to the remote, especially when upstream tracking or safety ch... | 1.0.0 | workflow |
| `review-architecture` | Use when: reviewing code for architectural violations — layer violations, dependency direction
mi... | 1.0.0 | review |
| `review-backend` | Use when: reviewing NestJS backend changes — API design, service layer, DTO validation,
database ... | 1.0.0 | review |
| `review-clean-code` | Use when: reviewing code against Clean Code principles (Uncle Bob) and SOLID at the
function/clas... | 1.0.0 | review |
| `review-frontend` | Use when a frontend review is requested, checking React component patterns, MobX state management... | 1.1.0 | review |
| `review-greptile` | Use when: a PR needs codebase-aware review using Greptile — an AI reviewer with full
repository i... | 1.0.0 | review |
| `review-highload` | Use when: reviewing code that will run under high concurrency or high traffic —
race conditions, ... | 1.0.0 | review |
| `review-logic` | Use when: reviewing code for logic correctness, algorithmic bugs, missing error handling,
async/a... | 1.0.0 | review |
| `review-orchestrator` | Use when: a code review is requested and the user does not explicitly name a specialized reviewer... | 1.3.0 | review |
| `review-performance` | Use when a performance review is requested, checking for N+1 queries, unnecessary re-renders, mem... | 1.0.0 | review |
| `review-pr-feedback` | Use when: a developer has received PR review comments and wants to understand them,
act on them, ... | 1.0.0 | review |
| `review-security-code` | Use when a code-level security review is requested, checking for injection vulnerabilities, auth ... | 1.0.0 | review |
| `review-strict` | Use when: a strict engineering pass is needed — either as a meta-reviewer reading consolidated
fi... | 1.0.0 | review |
| `review-style` | Use when: reviewing code for style, naming conventions, readability, and DRY violations —
without... | 1.0.0 | review |
| `security-audit` | Use when checking for dependency vulnerabilities, accidentally committed secrets, or security iss... | 1.0.0 | quality |
| `task-implementer` | Use when implementing a single decomposed task from issue-analyzer end-to-end, or executing auton... | 1.2.0 | implementation |
| `test-gen` | Use when unit or integration tests need to be written for a specific file or module. | 1.0.0 | testing |
| `tests-creator` | Use when writing test cases BEFORE implementation — converts acceptance criteria into failing tes... | 1.0.0 | testing |
