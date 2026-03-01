---
name: pr-review-comments
description: "Analyzes PR review comments from GitHub. Use when: user provides PR link, analyzing review feedback, extracting comments."
---

# PR Review Comments

Fetches and analyzes PR comments from GitHub.

## When to Use

- User says: "Analyze PR comments", "Review comments for PR [link]"
- PR link provided (GitHub)

## Process

1. **Extract PR info** from URL:
   - owner, repo, pullNumber

2. **Fetch comments** via GitHub MCP:
   - Review comments (on code)
   - General PR comments
   - Review verdicts

3. **Group by author**

4. **For b091 comments**:
   - Suggest rule updates (with user approval)

5. **Analyze each**:
   - Explanation
   - Possible fix

## Output

Grouped comments with analysis and fixes.
