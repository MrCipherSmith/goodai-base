#!/usr/bin/env bash
# detect-context.sh — Unified Skills + Rules Activation System
#
# Accepts a user prompt via stdin or $1, reads rules.json, and returns JSON:
#   { "matched_rules": [...], "matched_skills": [...] }
#
# Matched rules  → should be injected as context before Claude processes the prompt
# Matched skills → should appear as skill activation suggestions
#
# Usage:
#   echo "how do I write NestJS DTOs?" | scripts/detect-context.sh
#   scripts/detect-context.sh "how do I write NestJS DTOs?"
#
# Special: prompt starting with !nocontext → skip detection, return empty
# Exit code: always 0 (fail-open — must never block Claude)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RULES_JSON="$REPO_ROOT/rules.json"
LOG_FILE="${HOME}/.claude/logs/context-activation.log"

EMPTY='{"matched_rules":[],"matched_skills":[]}'

# Read prompt from $1 or stdin
if [[ $# -gt 0 ]]; then
  PROMPT="$*"
else
  PROMPT="$(cat 2>/dev/null || true)"
fi

# Fail-open: on any error, emit empty and exit 0
trap 'echo "$EMPTY"; exit 0' ERR

# Handle !nocontext prefix — bypass detection entirely
if [[ "$PROMPT" == "!nocontext"* ]]; then
  echo "$EMPTY"
  exit 0
fi

# Skip very short prompts
if [[ -z "$PROMPT" || "${#PROMPT}" -lt 3 ]]; then
  echo "$EMPTY"
  exit 0
fi

# Check rules.json exists
if [[ ! -f "$RULES_JSON" ]]; then
  echo "$EMPTY"
  exit 0
fi

# Run Python matcher
RESULT=$(python3 <<PYEOF 2>/dev/null
import json, sys, re, os

rules_json_path = """$RULES_JSON"""
prompt = """${PROMPT//\"/\\\"}"""
prompt_lower = prompt.lower()

EMPTY = '{"matched_rules":[],"matched_skills":[]}'

try:
    with open(rules_json_path, encoding='utf-8') as f:
        registry = json.load(f)
except Exception:
    print(EMPTY)
    sys.exit(0)

config = registry.get('config', {})
max_rules = config.get('max_rules_injected', 3)
min_keywords = config.get('rule_match_min_keywords', 1)
min_score = min_keywords * 2  # Each keyword hit = 2 pts

matched_rules = []   # (score, path)
matched_skills = []  # (score, path)

for entry in registry.get('entries', []):
    entry_type = entry.get('type', '')
    if entry_type not in ('rule', 'skill'):
        continue

    path = entry.get('path', '')
    triggers = entry.get('triggers', {})
    keywords = triggers.get('keywords', [])
    intents = triggers.get('intents', [])

    score = 0

    # Keyword matching (+2 each)
    for kw in keywords:
        if kw.lower() in prompt_lower:
            score += 2

    # Intent matching (+2 each)
    for intent in intents:
        try:
            if re.search(intent, prompt_lower, re.IGNORECASE):
                score += 2
        except re.error:
            pass

    if score < min_score:
        continue

    if entry_type == 'rule':
        matched_rules.append((score, path))
    else:
        matched_skills.append((score, path))

# Sort by score descending; cap rules at max_rules
matched_rules.sort(key=lambda x: -x[0])
matched_skills.sort(key=lambda x: -x[0])

result = {
    "matched_rules":  [r[1] for r in matched_rules[:max_rules]],
    "matched_skills": [s[1] for s in matched_skills],
}
print(json.dumps(result))
PYEOF
)

# Fall back to empty if python3 failed
RESULT="${RESULT:-$EMPTY}"

# Log activation event (non-blocking)
if [[ "$RESULT" != "$EMPTY" ]]; then
  PROMPT_HASH=$(printf '%s' "$PROMPT" | md5sum 2>/dev/null | awk '{print $1}' || printf 'unknown')
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
  printf '%s | prompt_hash=%s | %s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$PROMPT_HASH" "$RESULT" \
    >> "$LOG_FILE" 2>/dev/null || true
fi

echo "$RESULT"
exit 0
