#!/usr/bin/env bash
# generate-agents.sh — generate native Claude Code sub-agents from agent-worthy skills
#
# Usage:
#   scripts/generate-agents.sh [--output-dir <path>] [--dry-run] [--force]
#
# Reads skills/*/SKILL.md files with metadata.agent_worthy: true and generates
# ~/.claude/agents/<name>.md files in Claude Code native agent format.
#
# Frontmatter mapping:
#   SKILL.md name        → agent name
#   SKILL.md description → agent description
#   metadata.model       → agent model (optional)
#   metadata.tools       → agent tools (optional)
#   SKILL.md body        → agent system prompt
#
# Safety:
#   - Never overwrites agents NOT tracked in the registry (manually authored)
#   - Registry: skills/agents-registry.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"
REGISTRY_FILE="$REPO_ROOT/skills/agents-registry.json"
DEFAULT_OUTPUT_DIR="$HOME/.claude/agents"

OUTPUT_DIR="$DEFAULT_OUTPUT_DIR"
DRY_RUN=false
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    --dry-run)    DRY_RUN=true; shift ;;
    --force)      FORCE=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

COUNT_GENERATED=0
COUNT_UPDATED=0
COUNT_SKIPPED=0
COUNT_ERRORS=0

# Load existing registry
declare -A REGISTRY_CHECKSUMS  # skill_name -> source_checksum
declare -A REGISTRY_AGENT_PATHS  # skill_name -> agent_path
REGISTRY_TRACKED_AGENTS=()  # list of agent paths managed by registry

if [[ -f "$REGISTRY_FILE" ]]; then
  # Extract tracked agent paths from registry
  mapfile -t REGISTRY_TRACKED_AGENTS < <(python3 -c "
import json
try:
    data = json.load(open('$REGISTRY_FILE'))
    for entry in data.get('agents', []):
        print(entry.get('agent_path', ''))
except:
    pass
" 2>/dev/null || true)

  # Extract checksums and paths into associative arrays
  while IFS=$'\t' read -r name checksum path; do
    [[ -n "$name" ]] && REGISTRY_CHECKSUMS["$name"]="$checksum"
    [[ -n "$name" && -n "$path" ]] && REGISTRY_AGENT_PATHS["$name"]="$path"
  done < <(python3 -c "
import json
try:
    data = json.load(open('$REGISTRY_FILE'))
    for entry in data.get('agents', []):
        print(entry.get('skill_name','') + '\t' + entry.get('source_checksum','') + '\t' + entry.get('agent_path',''))
except:
    pass
" 2>/dev/null || true)
fi

# Compute checksum of a file (SHA256, portable)
_checksum() {
  if command -v sha256sum &>/dev/null; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

# Extract frontmatter field value (single-line, not nested)
_fm_field() {
  local file="$1" field="$2"
  awk '/^---$/{if(++c==1)next;else exit} c==1 && /^'"$field"':/{sub(/^'"$field"':[[:space:]]*/,""); gsub(/"/,""); print; exit}' "$file" 2>/dev/null || true
}

# Extract metadata sub-field (indented under metadata:)
_meta_field() {
  local file="$1" field="$2"
  python3 -c "
import sys, re
lines = open('$file').readlines()
in_fm = 0
in_meta = False
for line in lines:
    stripped = line.rstrip()
    if stripped == '---':
        in_fm += 1
        if in_fm >= 2:
            break
        continue
    if in_fm == 1:
        if stripped == 'metadata:':
            in_meta = True
        elif in_meta and re.match(r'^  $field:', stripped):
            val = stripped.split(':', 1)[1].strip().strip('\"').strip(\"'\")
            print(val)
            break
        elif in_meta and not stripped.startswith(' '):
            in_meta = False
" 2>/dev/null || true
}

# Extract body (content below second ---)
_body() {
  local file="$1"
  awk 'BEGIN{c=0} /^---$/{c++; if(c==2){found=1; next}} found{print}' "$file" 2>/dev/null || true
}

# Collect new registry entries
NEW_REGISTRY_ENTRIES=()

echo "Generating agents from: $SKILLS_DIR"
echo "Output dir: $OUTPUT_DIR"
[[ "$DRY_RUN" == "true" ]] && echo "(DRY RUN — no files written)"
echo ""

mkdir -p "$OUTPUT_DIR"

for skill_md in "$SKILLS_DIR"/*/SKILL.md; do
  [[ -f "$skill_md" ]] || continue

  # Check agent_worthy flag
  agent_worthy=$(_meta_field "$skill_md" "agent_worthy")
  if [[ "$agent_worthy" != "true" ]]; then
    continue
  fi

  skill_name=$(_fm_field "$skill_md" "name")
  if [[ -z "$skill_name" ]]; then
    echo "  ERROR: No name in $skill_md" >&2
    ((COUNT_ERRORS++)) || true
    continue
  fi

  description=$(_fm_field "$skill_md" "description")
  model=$(_meta_field "$skill_md" "model")
  tools=$(_meta_field "$skill_md" "tools")
  agent_path="$OUTPUT_DIR/$skill_name.md"
  source_checksum=$(_checksum "$skill_md")

  # Check if agent exists and is NOT in registry (manually authored) → skip
  if [[ -f "$agent_path" ]]; then
    is_tracked=false
    for tracked in "${REGISTRY_TRACKED_AGENTS[@]:-}"; do
      if [[ "$tracked" == "$agent_path" ]]; then
        is_tracked=true
        break
      fi
    done
    if [[ "$is_tracked" == "false" && "$FORCE" == "false" ]]; then
      echo "  SKIP: $skill_name — agent exists but is manually managed (not in registry)"
      ((COUNT_SKIPPED++)) || true
      continue
    fi
  fi

  # Check if up-to-date (checksum match)
  if [[ -f "$agent_path" && "${REGISTRY_CHECKSUMS[$skill_name]:-}" == "$source_checksum" ]]; then
    echo "  OK:   $skill_name — up-to-date"
    # Preserve existing registry entry
    NEW_REGISTRY_ENTRIES+=("$(python3 -c "
import json, datetime
print(json.dumps({
    'skill_name': '$skill_name',
    'source': '$skill_md',
    'agent_path': '$agent_path',
    'generated_at': '${REGISTRY_AGENT_PATHS[$skill_name]:-}',
    'source_checksum': '$source_checksum',
}))
" 2>/dev/null || echo '{}')")
    ((COUNT_SKIPPED++)) || true
    continue
  fi

  # Build agent frontmatter
  frontmatter="---\nname: $skill_name\ndescription: \"$description\""
  [[ -n "$model" ]] && frontmatter="$frontmatter\nmodel: $model"
  [[ -n "$tools" ]] && frontmatter="$frontmatter\ntools: $tools"
  frontmatter="$frontmatter\n---"

  # Get body
  body=$(_body "$skill_md")
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  header="<!-- AUTO-GENERATED by generate-agents.sh | source: $skill_md | generated: $timestamp -->"

  # Determine action
  action="Generate"
  if [[ -f "$agent_path" ]]; then
    action="Update"
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [DRY] $action: $skill_name → $agent_path"
  else
    printf '%b\n%s\n\n%s\n' "$frontmatter" "$header" "$body" > "$agent_path"
    echo "  $action: $skill_name → $agent_path"
  fi

  if [[ "$action" == "Generate" ]]; then
    ((COUNT_GENERATED++)) || true
  else
    ((COUNT_UPDATED++)) || true
  fi

  # Record registry entry
  NEW_REGISTRY_ENTRIES+=("$(python3 -c "
import json
print(json.dumps({
    'skill_name': '$skill_name',
    'source': '$skill_md',
    'agent_path': '$agent_path',
    'generated_at': '$(date -u +"%Y-%m-%dT%H:%M:%SZ")',
    'source_checksum': '$source_checksum',
}))
" 2>/dev/null || echo '{}')")
done

# Write registry (unless dry run)
if [[ "$DRY_RUN" == "false" && ${#NEW_REGISTRY_ENTRIES[@]} -gt 0 ]]; then
  python3 - "$REGISTRY_FILE" "${NEW_REGISTRY_ENTRIES[@]}" <<'PYEOF'
import json, sys

registry_path = sys.argv[1]
new_entries = [json.loads(e) for e in sys.argv[2:] if e.strip() and e.strip() != '{}']

# Load existing registry to preserve manually managed entries we didn't touch
existing = {}
if __import__('os').path.exists(registry_path):
    try:
        data = json.load(open(registry_path))
        for entry in data.get('agents', []):
            existing[entry['skill_name']] = entry
    except:
        pass

# Merge: new entries take precedence
for entry in new_entries:
    existing[entry['skill_name']] = entry

registry = {'agents': sorted(existing.values(), key=lambda x: x['skill_name'])}
with open(registry_path, 'w') as f:
    json.dump(registry, f, indent=2)
    f.write('\n')
PYEOF
fi

echo ""
echo "Summary: Generated: $COUNT_GENERATED | Updated: $COUNT_UPDATED | Skipped: $COUNT_SKIPPED | Errors: $COUNT_ERRORS"
