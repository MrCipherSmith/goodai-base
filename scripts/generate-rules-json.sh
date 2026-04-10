#!/usr/bin/env bash
# generate-rules-json.sh — Regenerate rules.json from AGENTS.md
#
# Parses the Core Rule Catalog and Skills Catalog sections of AGENTS.md,
# builds type:"rule" and type:"skill" entries with trigger keywords extracted
# from the descriptions, and writes/updates rules.json.
#
# Existing triggers.keywords in rules.json are PRESERVED (manually curated).
# Only entries missing from rules.json are added; existing entries get their
# description updated if it changed.
#
# Usage:
#   scripts/generate-rules-json.sh [--agents-md <path>] [--output <path>] [--dry-run]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENTS_MD="$REPO_ROOT/AGENTS.md"
OUTPUT="$REPO_ROOT/rules.json"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agents-md) AGENTS_MD="$2"; shift 2 ;;
    --output)    OUTPUT="$2"; shift 2 ;;
    --dry-run)   DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ ! -f "$AGENTS_MD" ]]; then
  echo "ERROR: AGENTS.md not found: $AGENTS_MD" >&2
  exit 1
fi

echo "Generating rules.json from: $AGENTS_MD"
[[ "$DRY_RUN" == "true" ]] && echo "(DRY RUN — no files written)"

python3 - "$AGENTS_MD" "$OUTPUT" "$REPO_ROOT" "$DRY_RUN" <<'PYEOF'
import json, sys, re, os

agents_md_path = sys.argv[1]
output_path    = sys.argv[2]
repo_root      = sys.argv[3]
dry_run        = sys.argv[4] == "true"

# ----------------------------------------------------------------
# Parse AGENTS.md for rule and skill entries
# ----------------------------------------------------------------

with open(agents_md_path, encoding='utf-8') as f:
    content = f.read()

EMPTY_ENTRY = {"keywords": [], "intents": []}

def derive_keywords(description):
    """Extract meaningful keywords from a description string."""
    text = description.lower()
    # Remove markdown formatting
    text = re.sub(r'[`*_]', '', text)
    # Split into words, filter stop words
    stop = {
        'and', 'or', 'the', 'for', 'with', 'from', 'that', 'this', 'when',
        'used', 'use', 'each', 'into', 'also', 'more', 'some', 'been',
        'have', 'will', 'not', 'are', 'but', 'any', 'all', 'via', 'its',
        'can', 'new', 'how', 'what', 'your', 'their', 'then',
    }
    words = re.findall(r'[a-z][a-z0-9]{2,}', text)
    return list(dict.fromkeys(w for w in words if w not in stop))[:8]

# Parse Core Rule Catalog section
# Format:  `- \`core/filename.mdc\`: Description text.`
rule_entries_parsed = {}
rule_section = re.search(
    r'##\s+📖\s+Core Rule Catalog(.*?)(?=##|\Z)', content, re.DOTALL
)
if rule_section:
    rule_text = rule_section.group(1)
    for m in re.finditer(r'`core/([^`]+\.mdc)`\s*:\s*(.+)', rule_text):
        filename = m.group(1).strip()
        description = m.group(2).strip().rstrip('.')
        rule_id = filename.replace('.mdc', '')
        path = f"rules/core/{filename}"
        rule_entries_parsed[rule_id] = {
            "id": rule_id,
            "type": "rule",
            "path": path,
            "description": description,
            "keywords_derived": derive_keywords(description),
        }

# Parse Skills Catalog section
# Format: **`skills/skill-name`** ... - **Purpose**: ... or description line
skill_entries_parsed = {}
skills_section = re.search(
    r'##\s+🎨\s+Skills Catalog(.*?)(?=^##\s+⚠️|^---|\Z)', content, re.DOTALL | re.MULTILINE
)
if skills_section:
    skills_text = skills_section.group(1)
    # Match **`skills/name`** blocks
    for m in re.finditer(r'\*\*`skills/([^`]+)`\*\*.*?(?=\*\*`skills/|\Z)', skills_text, re.DOTALL):
        skill_dir = m.group(1).strip()
        skill_block = m.group(0)
        # Extract purpose/description
        purpose_match = re.search(r'[-*]\s+\*\*Purpose\*\*:?\s*(.+)', skill_block)
        if not purpose_match:
            # Try first bullet
            purpose_match = re.search(r'-\s+(.+)', skill_block)
        description = purpose_match.group(1).strip() if purpose_match else skill_dir

        # Derive id from directory name
        skill_id = skill_dir
        path = f"skills/{skill_dir}/SKILL.md"
        skill_entries_parsed[skill_id] = {
            "id": skill_id,
            "type": "skill",
            "path": path,
            "description": description,
            "keywords_derived": derive_keywords(description),
        }

# ----------------------------------------------------------------
# Load existing rules.json to preserve manual triggers
# ----------------------------------------------------------------

existing_entries = {}
existing_config = {
    "max_rules_injected": 3,
    "skill_auto_activate_threshold": 0.9,
    "rule_match_min_keywords": 1
}

if os.path.exists(output_path):
    try:
        with open(output_path, encoding='utf-8') as f:
            existing = json.load(f)
        existing_config = existing.get("config", existing_config)
        for entry in existing.get("entries", []):
            existing_entries[entry["id"]] = entry
    except Exception as e:
        print(f"  WARN: Could not parse existing rules.json: {e}", flush=True)

# ----------------------------------------------------------------
# Merge: update description, preserve manual triggers
# ----------------------------------------------------------------

added = 0
updated = 0
preserved = 0

def build_entry(parsed, existing_entry=None):
    global added, updated, preserved
    eid = parsed["id"]
    existing_triggers = {}
    if existing_entry:
        existing_triggers = existing_entry.get("triggers", {})

    # Preserve manually curated triggers if they exist; otherwise derive
    keywords = existing_triggers.get("keywords") or parsed["keywords_derived"]
    intents = existing_triggers.get("intents") or []

    entry = {
        "id": eid,
        "type": parsed["type"],
        "path": parsed["path"],
        "description": parsed["description"],
        "triggers": {
            "keywords": keywords,
            "intents": intents,
        }
    }
    return entry

new_entries = {}

# Process rules
for rule_id, parsed in rule_entries_parsed.items():
    existing = existing_entries.get(rule_id)
    entry = build_entry(parsed, existing)
    new_entries[rule_id] = entry
    if existing:
        if existing.get("description") != parsed["description"]:
            print(f"  UPDATE rule: {rule_id} (description changed)")
            updated += 1
        else:
            preserved += 1
    else:
        print(f"  ADD rule: {rule_id}")
        added += 1

# Process skills
for skill_id, parsed in skill_entries_parsed.items():
    existing = existing_entries.get(skill_id)
    entry = build_entry(parsed, existing)
    new_entries[skill_id] = entry
    if existing:
        if existing.get("description") != parsed["description"]:
            print(f"  UPDATE skill: {skill_id} (description changed)")
            updated += 1
        else:
            preserved += 1
    else:
        print(f"  ADD skill: {skill_id}")
        added += 1

# Preserve existing entries that didn't appear in AGENTS.md parse
# (manually added entries)
for eid, entry in existing_entries.items():
    if eid not in new_entries:
        print(f"  PRESERVE manual entry: {eid}")
        new_entries[eid] = entry
        preserved += 1

# Build final registry
registry = {
    "version": "1.0.0",
    "generated_from": "AGENTS.md",
    "config": existing_config,
    "entries": list(new_entries.values()),
}

print(f"\nSummary: Added: {added} | Updated: {updated} | Preserved: {preserved}")
print(f"Total entries: {len(new_entries)} ({len(rule_entries_parsed)} rules, {len(skill_entries_parsed)} skills)")

if dry_run:
    print("\n[DRY RUN] Would write to:", output_path)
else:
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f"\nWritten: {output_path}")
PYEOF
