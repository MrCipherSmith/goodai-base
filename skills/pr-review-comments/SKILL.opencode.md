---
name: pr-review-comments
description: "Fetches and analyzes PR review comments via GitHub MCP or gh CLI. Groups comments by author, provides explanation and fix suggestions for each. For b091 comments, proposes rule updates with user consent. Use when: user provides PR link, analyzing review feedback, extracting actionable items from code reviews."
triggers:
  - "Analyze PR comments"
  - "Review comments for PR"
  - "Parse PR feedback"
  - "PR review comments"
  - "What did b091 write in PR"
  - "Update rule from b091 review"
metadata:
  author: "MrCipherSmith"
  version: "1.0.0"
  category: "analysis"
license: "MIT"
compatibility: "cursor,codex,zed,opencode"
---

# PR Review Comments Analyzer

## Purpose

Collects, groups, and analyzes GitHub PR review comments to provide actionable insights and fixes.

## When to Use

- User provides PR URL and asks to analyze comments
- "What did reviewers say about this PR?"
- "Explain these review comments"
- "Extract feedback from PR review"
- Review mentions b091 feedback

## Workflow

Copy this checklist and track progress:

```
Task Progress:
- [ ] Step 1: Parse PR URL and extract owner/repo/pullNumber
- [ ] Step 2: Fetch all comment types via GitHub MCP
- [ ] Step 3: Group comments by author
- [ ] Step 4: Check for b091 comments and handle rule updates
- [ ] Step 5: Analyze each comment with explanation and fix
- [ ] Step 6: Generate structured report
```

### Step 1: Parse PR URL

Extract from formats:
- `https://github.com/owner/repo/pull/123` → owner, repo, pullNumber
- `https://github.com/owner/repo/issues/123` → owner, repo, pullNumber
- `owner/repo#123` → owner, repo, pullNumber

### Step 2: Fetch Comments via GitHub MCP

Use MCP server: `github-mcp-server` or `mcp-server-github`

**Review comments** (line-specific):
```
method: get_review_comments
owner, repo, pullNumber
```

**Issue/PR comments** (general discussion):
```
method: get_comments
owner, repo, pullNumber
```

**Review verdicts** (APPROVE/REQUEST_CHANGES/COMMENT):
```
method: get_reviews
owner, repo, pullNumber
```

Alternative via gh CLI:
```bash
gh api repos/{owner}/{repo}/pulls/{pullNumber}/comments
gh api repos/{owner}/{repo}/issues/{pullNumber}/comments
gh api repos/{owner}/{repo}/pulls/{pullNumber}/reviews
```

### Step 3: Group by Author

Organize comments by `author.login`:

```markdown
## Comment Summary by Author

### author1 (N comments)
- file.ts:42 - "comment text"
- file.ts:78 - "comment text"
- General: "comment text"

### author2 (N comments)
...
```

### Step 4: Handle b091 Comments

If author == "b091":
1. Notify user: "PR contains comments from b091"
2. **NEVER update rules without explicit user consent**
3. Ask: "Should I analyze b091's comments and suggest updates to core/code-review-b091-profile.mdc?"
4. If user agrees:
   - Identify patterns in b091's feedback
   - Update `~/goodai-base/rules/core/code-review-b091-profile.mdc`
   - Update `~/goodai-base/AGENTS.md` if needed
   - Run `~/goodai-base/scripts/sync-skills.sh`
   - Follow `rule-management-workflow.mdc`
5. Extract general patterns, not personal phrases

### Step 5: Analyze Each Comment

For every comment provide:

```markdown
**File:Line** - Author
> Original comment

**Explanation**: What the reviewer means, context, type of issue (architecture/types/conventions/lint/scope)

**Suggested Fix**: 
```typescript
// Corrected code example
```

**Confidence**: High/Medium/Low
```

### Step 6: Generate Report

Structure:
```markdown
# PR Review Analysis

## Summary
- Total comments: N
- Reviewers: N authors
- Verdict: [APPROVE/REQUEST_CHANGES/COMMENT]

## Critical Issues (must address)
[High-confidence fixes]

## Suggestions (consider)
[Medium/low confidence improvements]

## By Author
[Grouped analysis]

## Action Items
- [ ] Item 1
- [ ] Item 2
```

## Quality Standards

- Evidence-based explanations only
- Provide concrete code fixes
- Group related comments
- Prioritize by severity
- Don't overwhelm with minor style issues

## Output Contract

1. Always group by author first
2. Always provide explanation + fix for each
3. For b091: ask before updating rules
4. Use code blocks for suggested fixes
5. Include confidence level for each suggestion
