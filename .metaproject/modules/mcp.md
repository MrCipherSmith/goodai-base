# MCP Module

Version: 0.1.0
Type: module
Status: active

## Summary

Exposes read-only Metaproject services (code graph, security, flow status,
memory, health, wiki, standard) over the Model Context Protocol (MCP). A thin
protocol adapter — it defines no new module logic.

## Commands

- `keryx mcp serve` — stdio JSON-RPC MCP server (default transport).
- `keryx mcp serve --http` — isolated HTTP/SSE opt-in (localhost only;
  requires `http.enabled=true` in this module's manifest entry).
- `keryx mcp serve --cwd <project-root>` — expose a specific project,
  independent of the MCP client's launch directory.

## Notes

- Requires the optional `@modelcontextprotocol/sdk`. Disabled by default.
- Every tool result is routed through the security `redactRaw` seam before
  transport.
- Tool/resource exposure is filtered by the manifest (`expose.modules`); a
  disabled module is hidden from `tools/list` and `resources/list`.
