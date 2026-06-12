# Greptile Integration

> Greptile adds **codebase-aware AI review** to the goodai-base review domain. Unlike diff-only reviewers, Greptile indexes the entire repository — it understands cross-file impact and can catch bugs that aren't visible inside the diff.

---

## What Greptile Does That Diff-Only Reviewers Can't

| Capability | Diff-only reviewers | Greptile |
|---|---|---|
| Logic bugs in changed code | ✓ | ✓ |
| Cross-file impact (change breaks a caller not in diff) | ✗ | ✓ |
| Codebase-wide pattern violations | ✗ | ✓ |
| Downstream breakage detection | ✗ | ✓ |
| Understanding conventions from project history | ✗ | ✓ |
| Custom context (team-documented exceptions) | ✗ | ✓ |

Use Greptile alongside the domain's specialized reviewers — they complement each other.

---

## Prerequisites

1. **PR number** — Greptile reviews PRs, not arbitrary diffs. Path mode is not supported.
2. **Greptile API key** — required for the MCP connection.
3. **Claude Code MCP configured** — the Greptile MCP server must be active in `~/.claude.json`.

---

## Setup (one-time)

### Option A: via goodai-base CLI (recommended)

```bash
npx goodai-base setup-greptile
```

The command will:
1. Check if Greptile is already configured — skips if yes
2. Show the link to get a free API key
3. Prompt for the key
4. Write the MCP config to `~/.claude.json`
5. Add `export GREPTILE_API_KEY=...` to `~/.zshrc` and `~/.bashrc`

Restart Claude Code after running.

### Option B: manual

1. Get an API key at **app.greptile.com → Settings → API Keys → New Key**
2. Add to `~/.claude.json` under `mcpServers`:

```json
"greptile": {
  "type": "http",
  "url": "https://api.greptile.com/mcp",
  "headers": {
    "Authorization": "Bearer YOUR_API_KEY"
  }
}
```

3. Optionally add to shell rc:

```bash
export GREPTILE_API_KEY="your_key"
```

4. Restart Claude Code.

---

## Pricing

| Use case | Cost |
|---|---|
| Open-source projects (MIT / Apache / GPL, non-commercial) | **Free** — apply at greptile.com/open-source |
| Commercial projects | Enterprise pricing — contact Greptile |

For open-source: submit the application form with your email, repo link, and confirm you are the repo owner/admin. Approval is typically fast.

---

## How to Use

### Via review-orchestrator (recommended)

```
review --greptile          # Greptile only, on current PR
review --all               # all reviewers including Greptile (when PR is detected)
```

With `--all`, the orchestrator auto-detects the PR number via `gh pr view`. If no PR exists for the current branch, Greptile is skipped silently.

### Standalone

```
greptile review
review with greptile
review PR #42 with greptile
```

### In a job pipeline

When dispatched by `job-orchestrator` or `review-orchestrator`, pass:

```
PR_NUMBER:  42
REPO:       owner/repo
REMOTE:     github   # or gitlab
```

---

## How review-greptile Works Internally

```
Step 1  Resolve repo name and PR number (from input or git remote + gh pr view)
Step 2  Trigger review: mcp__greptile__trigger_code_review(repo, prNumber, remote)
          → returns codeReviewId
Step 3  Poll: mcp__greptile__get_code_review(codeReviewId)
          → poll every ~10s, up to 5 retries
          → status: pending | in_progress | completed | failed
Step 4  Parse findings → normalize to G-NNN unified format
Step 5  Check custom context: mcp__greptile__search_custom_context(topic)
          → mark as info if a finding is a documented exception
Step 6  Emit STATUS + report
```

Review is **async** — Greptile indexes the full codebase before reviewing. Typical time: 30–120 seconds depending on repo size.

---

## Finding Format

Greptile findings use the `G-` prefix to distinguish them from domain reviewer findings (`F-`):

```markdown
### [G-001] Title

- **Severity**: blocker | major | minor | info
- **File**: path/to/file.ts:42
- **Source**: Greptile (codebase-aware)
- **Problem**: what is wrong, including cross-file context if applicable
- **Cross-file context**: describes impact in files not in the diff (Greptile-specific)
- **Fix**: concrete suggestion
```

Greptile findings appear in the consolidated report under a dedicated section:

```markdown
## Greptile (Codebase-Aware Findings)
[G-NNN findings — especially cross-file impact not caught by other reviewers]
```

---

## Integration with context-collector

When `context-collector` runs as part of a job pipeline, it automatically queries Greptile for codebase context (Phase 2.6):

- `mcp__greptile__search_custom_context` — project patterns and documented conventions
- `mcp__greptile__search_greptile_comments` — recurring findings from past reviews

This enriches the `context.md` used by all sub-agents in the job, including `task-implementer`. Sub-agents get Greptile's accumulated project knowledge without explicitly calling it.

If Greptile MCP is unavailable or returns empty — silently skipped, no impact on the pipeline.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `BLOCKED: Greptile MCP not available` | MCP not configured or Claude Code not restarted | Run `npx goodai-base setup-greptile`, restart Claude Code |
| Review stays `pending` indefinitely | Large repo first-time indexing | Wait longer; Greptile indexes the full repo on first use (can take 5–10 min) |
| `401 Unauthorized` | Invalid or expired API key | Get a new key at app.greptile.com, re-run `setup-greptile` |
| No PR found | No open PR for current branch | Create a PR first, or provide PR number explicitly |
| Greptile skipped in `--all` | `gh pr view` returned no PR | Push the branch, open a PR, then re-run |
