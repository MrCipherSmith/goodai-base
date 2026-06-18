# Shared: graphify Knowledge-Graph Lookup

## Purpose

Reusable lookup step. When a graphify knowledge graph exists for the repo, prefer it over
blind `grep` for code-structure, relationship, ownership, lifecycle, and impact questions.
Used by review, analysis, and implementation skills.

## Gate

Check once at the start of context gathering:

```bash
GRAPHIFY_BIN="$(command -v graphify || true)"
if [ -z "$GRAPHIFY_BIN" ] && [ -x "$HOME/.local/bin/graphify" ]; then
  GRAPHIFY_BIN="$HOME/.local/bin/graphify"
fi

if [ -f graphify-out/graph.json ] && [ -n "$GRAPHIFY_BIN" ]; then
  echo "graphify: available ($GRAPHIFY_BIN)"
elif [ ! -f graphify-out/graph.json ]; then
  echo "graphify: none - use normal search"
else
  echo "graphify: graph present but CLI unavailable - use normal search"
fi
```

## Commands

| Need | Command |
|---|---|
| Where/how something is defined or used | `$GRAPHIFY_BIN query "<question>"` |
| How two symbols relate | `$GRAPHIFY_BIN path "<A>" "<B>"` |
| A node plus its neighbourhood | `$GRAPHIFY_BIN explain "<symbol>"` |
| Blast radius - what a change impacts | `$GRAPHIFY_BIN affected "<symbol>"` |

## Mandatory Review Usage

During code review, if `graphify-out/graph.json` exists and `GRAPHIFY_BIN` is available:

1. For each changed exported class, store, API wrapper, service, adapter, component, manager,
   core export, flow node, or shared utility, run `$GRAPHIFY_BIN affected "<symbol>"`.
2. For lifecycle, ownership, or dependency questions, run `$GRAPHIFY_BIN path "<A>" "<B>"`
   or `$GRAPHIFY_BIN explain "<symbol>"`.
3. For broad module questions, run `$GRAPHIFY_BIN query "<question>" --budget 3000`.
4. Treat graph output as navigation only. Confirm every finding against the actual code.
5. Record graph usage in the review result:
   - `graph_context: used` with the queries run; or
   - `graph_context: unavailable` with `missing_graph`, `missing_cli`, or `query_failed`.

## Cross-Repo MCP Graphs

If an MCP server exposing another repo's graph is registered, use its MCP tools for cross-repo
questions without leaving the current repo. When Codex exposes a backend graph MCP server, use
these exact tools:

- `mcp__backend_graph.query_graph` for backend concept lookup.
- `mcp__backend_graph.get_neighbors` for direct dependency checks.
- `mcp__backend_graph.shortest_path` for ownership, lifecycle, and dependency paths.
- `mcp__backend_graph.get_pr_impact` for PR blast radius.
- `mcp__backend_graph.god_nodes` for architecture hub detection.

The backend MCP graph does not replace the current repo's `graphify-out/graph.json`; they are
separate graphs and should be used for their respective repositories.

## Rules

- Treat graph results as a map, not proof; confirm the actual code before asserting or acting.
- Never block on graphify. If the CLI or graph is missing, continue with normal search.
- Review agents must still record why graph context was unavailable.
- Do not build or update the graph as a side effect of a review or analysis task unless the task
  is explicitly about graphify.
