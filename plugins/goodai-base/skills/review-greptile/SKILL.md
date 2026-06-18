---
name: review-greptile
description: |
  Use when: a PR needs codebase-aware review using Greptile — an AI reviewer with full
  repository indexing. Unlike diff-only reviewers, Greptile understands cross-file impact
  across the entire codebase. Triggered by: "greptile review", "review with greptile",
  "review --greptile", or dispatched by review-orchestrator on PRs.
  Requires: PR number + GitHub/GitLab repo name.
  NOT for: path-mode reviews or diff without a PR number — use other review-* skills instead.
version: "1.0.0"
triggers:
  - "greptile review"
  - "review with greptile"
  - "review --greptile"
  - dispatched by review-orchestrator
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "review"
license: "MIT"
compatibility: "cursor,codex,zed,opencode,claude"
---

# Review: Greptile (Codebase-Aware)

Greptile reviews PRs with **full codebase understanding** — it indexes the entire repository,
not just the diff. This makes it uniquely capable of detecting cross-file impact: a change
in one module that breaks an assumption in another module not present in the diff.

Complementary to the domain's diff-only specialized reviewers: use both together for the most
complete picture.

---

## What Greptile Adds Over Diff-Only Reviewers

| Capability | Diff-only reviewers | Greptile |
|---|---|---|
| Logic bugs in changed code | ✓ | ✓ |
| Cross-file impact analysis | ✗ | ✓ |
| Codebase-wide pattern violations | ✗ | ✓ |
| Detecting broken callers (downstream breakage) | ✗ | ✓ |
| Understanding project conventions from history | ✗ | ✓ |
| Custom context (team-documented exceptions) | ✗ | ✓ |

---

## Workflow

```
Greptile Review Progress:
- [ ] Step 1: Resolve repo name and PR number
- [ ] Step 2: Trigger Greptile code review via MCP
- [ ] Step 3: Poll until review is ready
- [ ] Step 4: Parse findings into unified format
- [ ] Step 5: Check custom context for known exceptions
- [ ] Step 6: Emit findings with STATUS
```

---

## Input Contract

| Field | Required | Description |
|-------|----------|-------------|
| `pr_number` | YES | Pull request or merge request number |
| `repo` | YES | Full repo name: `owner/repo` (e.g., `MrCipherSmith/goodai-base`) |
| `remote` | No | `github` (default) or `gitlab` |
| `branch` | No | PR branch name. Auto-detected if not provided. |
| `base_branch` | No | Base/default branch. Auto-detected if not provided. |
| `context_doc` | No | Path to job context doc — read before reviewing |

---

## Step 1: Resolve Repo and PR

If `repo` is not provided, resolve from the current git remote:

```bash
git remote get-url origin
# Extract owner/repo from URL:
# https://github.com/owner/repo.git  →  owner/repo
# git@github.com:owner/repo.git      →  owner/repo
```

If `pr_number` is not provided and user said "review PR" without a number:

```bash
# Get current branch PR
gh pr view --json number,headRefName,baseRefName
```

---

## Step 2: Trigger Greptile Review

Call the Greptile MCP tool:

```
mcp__greptile__trigger_code_review({
  name: "<owner/repo>",
  remote: "github",       // or "gitlab"
  prNumber: <number>,
  branch: "<PR branch>",           // optional
  defaultBranch: "<base branch>"   // optional
})
```

This returns a `codeReviewId` used to retrieve results.

---

## Step 3: Poll for Results

Greptile reviews are async. After triggering:

```
mcp__greptile__get_code_review({ codeReviewId: "<id>" })
```

The response includes a `status` field:
- `pending` / `in_progress` — wait and retry (suggest ~10s intervals, up to 5 retries)
- `completed` — parse findings
- `failed` — emit STATUS: BLOCKED with error message

If still `pending` after retries, tell the user: "Greptile review is running — check back with `get_code_review(<id>)`."

---

## Step 4: Parse Findings

Normalize each Greptile finding to the domain's unified format:

```markdown
### [G-NNN] <title from Greptile>

- **Severity**: <map Greptile severity to blocker | major | minor | info>
- **File**: <path>:<line>
- **Source**: Greptile (codebase-aware)
- **Problem**: <Greptile's description>
- **Cross-file context**: <if Greptile identified impact in other files — describe them>
- **Fix**: <Greptile's suggestion>
```

**Severity mapping from Greptile:**

| Greptile level | Domain severity |
|---|---|
| critical / error | blocker |
| warning | major |
| suggestion / info | minor |
| comment / note | info |

Use prefix `G-` for finding IDs to distinguish Greptile findings from domain reviewer findings (`F-`).

---

## Step 5: Check Custom Context

After getting findings, check if Greptile has stored custom context for this repo:

```
mcp__greptile__get_custom_context({ ... })
// or search for relevant context:
mcp__greptile__search_custom_context({ query: "<topic of finding>" })
```

If custom context exists that explains or excuses a finding — mark the finding as `info` and note the exception.

---

## Graphify Impact Pass

Before emitting findings, run the shared graphify lookup for changed symbols when `graphify-out/graph.json` exists. See `skills/shared/graphify-lookup.md`. Use `graphify affected` for exported classes, stores, API wrappers, services, adapters, components, managers, core exports, flow nodes, shared utilities, and other symbols whose blast radius is relevant to this reviewer. For ownership, lifecycle, or dependency questions, use `graphify path` or `graphify explain`. If a backend graph MCP server is available, use the explicit `mcp__backend_graph.*` tools listed in the shared lookup for backend contract or cross-repo questions. Treat graph output as navigation only and verify every finding in code. Record `graph_context: used` with queries run, or `graph_context: unavailable` with the reason.

## Output Contract

```
STATUS: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
```

```markdown
## Greptile Review — PR #<N>

### Review Scope
- Repo: `<owner/repo>`
- PR: #<N>
- Remote: github | gitlab
- Review ID: `<codeReviewId>`

### Summary
<2-3 sentences: what Greptile found, cross-file impact summary if any.>

### Stats
- blocker (G-): N  |  major (G-): N  |  minor (G-): N  |  info (G-): N

### Findings

#### Cross-File Impact (Greptile-specific)
<G-NNN findings where Greptile identified impact beyond the diff, or "None detected.">

#### Other Findings
<G-NNN findings within the diff scope.>

### Greptile Review ID
`<codeReviewId>` — use this to re-fetch results or link in PR comments.
```

---

## Job Context Awareness

When dispatched by `review-orchestrator`, the prompt MAY include:

```
JOB_NAME:     <job-name>
CONTEXT_PATH: <JOBS_ROOT>/<job-name>/ai/context.md
```

Read the context doc before reviewing. It may contain known exceptions or intentional patterns that Greptile would flag but are acceptable.

---

## Red Flags

| Rationalization | Why it is wrong |
|---|---|
| "Greptile found nothing, so the PR is safe" | Greptile complements diff-only reviewers; use both |
| "I'll skip polling and just return pending" | Always poll at least 3 times before giving up — async reviews take time |
| "The custom context says this is fine, so I'll suppress the finding entirely" | Document the exception as `info`, don't silently drop the finding |
| "Greptile's severity maps directly to domain severity" | Always re-evaluate — Greptile's "warning" may be a `blocker` given the codebase context |


## Orchestrated Review Contract

When dispatched by `review-orchestrator`, follow the provided `reviewer-input.schema.json` payload. Return a `REVIEW_RESULT` object compatible with `skills/review-orchestrator/reviewer-finding.schema.json`, then a concise markdown summary. Keep findings evidence-based, include concrete `suggested_fix` for every blocker/major, and return `NEEDS_CONTEXT` instead of guessing when required context is missing.

---
