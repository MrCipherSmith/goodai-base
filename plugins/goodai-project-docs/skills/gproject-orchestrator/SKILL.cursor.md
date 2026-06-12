---
name: gproject-orchestrator
description: "Project documentation pipeline orchestrator — Discovery→Problem→Stack→Patterns→PRD→Review→Roadmap. Use when: writing PRD, planning project, creating specs, documenting features, project planning."
triggers:
  - "gproject"
  - "Write PRD"
  - "Plan project"
  - "Create project documentation"
  - "Spec out feature"
  - "Создай документацию проекта"
  - "Напиши PRD"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "planning"
license: "MIT"
compatibility: "cursor,codex,zed,opencode"
---


<!-- SUBAGENT-STOP: If you are a subagent dispatched by another orchestrator, HALT.
     Return STATUS: BLOCKED — gproject-orchestrator must run as top-level agent only. -->

# gproject-orchestrator

## Purpose

Thin orchestrator that drives a project documentation pipeline through 7 phases.
Each phase dispatches a specialized subagent, collects a compact summary,
and persists full artifacts to disk. The orchestrator never reads full artifacts —
it operates on summaries, decisions, and statuses only.
