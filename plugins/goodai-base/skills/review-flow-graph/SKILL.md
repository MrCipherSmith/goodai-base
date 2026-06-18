---
name: review-flow-graph
description: |
  Use when reviewing generic ReactFlow or graph-surface abstraction changes:
  public graph surface, store subclassing, layout lifecycle, internal helper
  boundaries, selection lifecycle, and large-graph performance. Dispatched by
  review-orchestrator for --flow-graph, --project-conventions, --all, or
  src/core/flow/** / graph abstraction changes.
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "review"
license: "MIT"
---

# Review — Flow Graph Abstractions

Reviewer for reusable ReactFlow/graph integration layers. Use it when a repository has a shared
graph surface consumed by domain modules.

---

## Scope

Applicable to shared graph/flow abstraction folders such as `src/core/flow/**`,
`src/graph/**`, `src/shared/flow/**`, and consumers adding a new graph surface through the
shared public API.

If the repository has local graph docs, read them first and treat this checklist as a neutral
baseline.

---

## Checklist

### Public Surface

- Domain modules consume the documented public graph surface instead of mounting internal shell
  or bridge modules directly.
- New exports are added only when more than one domain consumer needs them.
- Public graph components own common setup such as loader/splitter/viewport wiring/toolbars.

### Store and Lifecycle

- Static viewers and expandable/progressive graphs use the appropriate base store or abstraction.
- Subclasses initialize base state before local observability/reactivity.
- Domain side effects preserve base selection/click/reset behaviour.
- Expand/collapse graphs define fetch and direction/availability contracts explicitly.
- Independent graph data fetches run in parallel and merge through a deduplication helper.

### Internal Boundary

- Layout helpers, shell components, bridge hooks, SVG/canvas geometry helpers, export helpers,
  and popup/container utilities stay internal unless there is a real shared public need.
- New pure node/edge helpers live close to the graph abstraction.
- New visual primitives live in the graph abstraction layer only when domain-neutral.
- Domain-specific data shapes and selection details stay in domain modules.

### Shared Graph Defaults and Performance

- Shared graph defaults are configured in one surface, not repeated per consumer.
- Large nodes/edges arrays avoid deep observation/proxying when shallow/reference observation is
  enough.
- Selection/detail slots use reference semantics when values are swapped as units.
- Lookup maps/indexes are computed once from source arrays for O(1) access.
- Hand graph libraries fresh array references without deep cloning on every render.
- User-initiated graph changes batch writes.
- Animated edge/node effects do not restart unnecessarily on parent rerenders.
- Level-of-detail logic uses discrete thresholds or policy helpers rather than per-frame UI
  rerenders.

---

## Graphify Impact Pass

Before emitting findings, run the shared graphify lookup for changed symbols when `graphify-out/graph.json` exists. See `skills/shared/graphify-lookup.md`. Use `graphify affected` for exported classes, stores, API wrappers, services, adapters, components, managers, core exports, flow nodes, shared utilities, and other symbols whose blast radius is relevant to this reviewer. For ownership, lifecycle, or dependency questions, use `graphify path` or `graphify explain`. If a backend graph MCP server is available, use the explicit `mcp__backend_graph.*` tools listed in the shared lookup for backend contract or cross-repo questions. Treat graph output as navigation only and verify every finding in code. Record `graph_context: used` with queries run, or `graph_context: unavailable` with the reason.

## Orchestrated Review Contract

When dispatched by `review-orchestrator`, follow the provided `reviewer-input.schema.json` payload. Return a `REVIEW_RESULT` object compatible with `skills/review-orchestrator/reviewer-finding.schema.json`, then a concise markdown summary. Keep findings evidence-based, include concrete `suggested_fix` for every blocker/major, and return `NEEDS_CONTEXT` instead of guessing when required context is missing.

---

## Finding Format

```markdown
### [F-NNN] Title

- **Severity**: blocker | major | minor | info
- **File**: path/to/graph/file.ts:line
- **Problem**: which graph abstraction contract is violated
- **Why it matters**: public surface stability, graph correctness, or performance impact
- **Fix**: concrete change aligned with the shared graph surface
```

Severity guidance: breaking the public surface or bypassing base selection/layout lifecycle is
usually `major`; performance regressions on large graphs can be `major` or `blocker`.
