#!/usr/bin/env bash
# generate-skill-registry.sh
# Regenerates hooks/skill-registry.json from skills/*/SKILL.md frontmatter.
#
# Usage:
#   scripts/generate-skill-registry.sh [--skills-dir <path>] [--output <path>]
#
# The script reads SKILL.md files looking for a `triggers` frontmatter field:
#
#   ---
#   name: my-skill
#   description: "What this skill does"
#   triggers:
#     keywords: ["keyword one", "keyword two"]
#     patterns: ["regex.*pattern"]
#     paths: [".store.ts"]
#   ---
#
# If no triggers block is found, the description is used to derive keywords.
# Existing registry entries are preserved for fields not present in frontmatter.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"
OUTPUT="$REPO_ROOT/hooks/skill-registry.json"
REGISTRY_VERSION="1.0.0"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skills-dir) SKILLS_DIR="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "ERROR: Skills directory not found: $SKILLS_DIR" >&2
  exit 1
fi

echo "Scanning skills in: $SKILLS_DIR"
echo "Output: $OUTPUT"

# Collect skill entries
SKILLS_JSON=""
COUNT=0
SKIPPED=0

for skill_md in "$SKILLS_DIR"/*/SKILL.md; do
  [[ -f "$skill_md" ]] || continue

  skill_dir="$(dirname "$skill_md")"
  skill_name="$(basename "$skill_dir")"

  # Extract frontmatter block (between first --- and second ---)
  frontmatter=$(awk '/^---$/{if(++c==1){next}else{exit}} c==1{print}' "$skill_md" 2>/dev/null || true)

  if [[ -z "$frontmatter" ]]; then
    echo "  WARN: No frontmatter in $skill_md — skipping" >&2
    ((SKIPPED++)) || true
    continue
  fi

  # Extract name (use directory name as fallback)
  name=$(echo "$frontmatter" | grep -E '^name:' | sed 's/^name:[[:space:]]*//' | tr -d '"' | head -1)
  name="${name:-$skill_name}"

  # Extract description
  description=$(echo "$frontmatter" | grep -E '^description:' | sed 's/^description:[[:space:]]*//' | tr -d '"' | head -1)

  # Extract triggers.keywords (YAML array on one line or multiline)
  # Support: keywords: ["a", "b"] or keywords: [a, b]
  keywords_raw=$(echo "$frontmatter" | grep -E '^\s*keywords:' | sed 's/.*keywords:[[:space:]]*//' | head -1)

  # Extract triggers.patterns
  patterns_raw=$(echo "$frontmatter" | grep -E '^\s*patterns:' | sed 's/.*patterns:[[:space:]]*//' | head -1)

  # Extract triggers.paths
  paths_raw=$(echo "$frontmatter" | grep -E '^\s*paths:' | sed 's/.*paths:[[:space:]]*//' | head -1)

  # Convert YAML arrays to JSON arrays
  # If raw is empty or "[]", use empty array
  # Otherwise, attempt to parse inline YAML array: ["a", "b"] or [a, b]
  yaml_to_json_array() {
    local raw="$1"
    if [[ -z "$raw" || "$raw" == "[]" ]]; then
      echo "[]"
      return
    fi
    # If it looks like a JSON array already, use it
    if [[ "$raw" =~ ^\[.*\]$ ]]; then
      # Normalize: ensure quoted strings
      echo "$raw" | python3 -c "
import sys, json
try:
    raw = sys.stdin.read().strip()
    # Try parsing as JSON first
    arr = json.loads(raw)
    print(json.dumps(arr))
except:
    # Fallback: strip brackets, split by comma
    inner = raw.strip('[]')
    items = [x.strip().strip('\"').strip(\"'\") for x in inner.split(',') if x.strip()]
    print(json.dumps(items))
" 2>/dev/null || echo "[]"
    else
      # Scalar value — wrap in array
      local val
      val=$(echo "$raw" | tr -d '"' | tr -d "'")
      echo "[\"$val\"]"
    fi
  }

  keywords_json=$(yaml_to_json_array "$keywords_raw")
  patterns_json=$(yaml_to_json_array "$patterns_raw")
  paths_json=$(yaml_to_json_array "$paths_raw")

  # If keywords is empty, derive from description (split on spaces, take words >= 4 chars)
  if [[ "$keywords_json" == "[]" && -n "$description" ]]; then
    keywords_json=$(echo "$description" | python3 -c "
import sys, json, re
text = sys.stdin.read().lower()
words = re.findall(r'[a-z]{4,}', text)
# Filter common stop words
stop = {'with','that','this','from','have','will','when','then','what','your','their','they','into','more','some','been','were','also','used','each','which','these'}
kws = [w for w in words if w not in stop][:6]
print(json.dumps(kws))
" 2>/dev/null || echo "[]")
  fi

  # Build JSON entry
  entry=$(python3 -c "
import json
entry = {
    'name': $(echo "$name" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))"),
    'description': $(echo "$description" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))"),
    'keywords': $keywords_json,
    'patterns': $patterns_json,
    'paths': $paths_json,
    'minScore': 4,
}
print(json.dumps(entry, indent=2, ensure_ascii=False))
" 2>/dev/null)

  if [[ -z "$entry" ]]; then
    echo "  WARN: Failed to build entry for $skill_name" >&2
    ((SKIPPED++)) || true
    continue
  fi

  if [[ -n "$SKILLS_JSON" ]]; then
    SKILLS_JSON="$SKILLS_JSON,$entry"
  else
    SKILLS_JSON="$entry"
  fi

  echo "  + $name"
  ((COUNT++)) || true
done

# Preserve existing hookConfig if registry already exists
HOOK_CONFIG='{
    "enabled": true,
    "maxSuggestions": 3,
    "globalMinScore": 4,
    "wholeWordMatch": false
  }'

if [[ -f "$OUTPUT" ]]; then
  existing_config=$(python3 -c "
import json, sys
try:
    data = json.load(open('$OUTPUT'))
    print(json.dumps(data.get('hookConfig', {}), indent=4))
except:
    print('{}')
" 2>/dev/null || echo '{}')
  if [[ "$existing_config" != "{}" ]]; then
    HOOK_CONFIG="$existing_config"
  fi
fi

# Write output
mkdir -p "$(dirname "$OUTPUT")"

python3 -c "
import json, sys

skills_raw = '$SKILLS_JSON'

# Parse skills list
try:
    skills = json.loads('[' + skills_raw + ']')
except Exception as e:
    skills = []

hook_config = $HOOK_CONFIG

registry = {
    'version': '$REGISTRY_VERSION',
    'generated_from': 'skills/*/SKILL.md',
    'hookConfig': hook_config,
    'skills': skills,
}

with open('$OUTPUT', 'w', encoding='utf-8') as f:
    json.dump(registry, f, indent=2, ensure_ascii=False)
    f.write('\n')
print('Written:', '$OUTPUT')
" 2>/dev/null

echo ""
echo "Done. Generated: $COUNT skills, Skipped: $SKIPPED"
echo "Output: $OUTPUT"
