#!/usr/bin/env bash
# validate-rules-json.sh — Validate rules.json against disk and AGENTS.md
#
# Checks:
#   1. rules.json is valid JSON
#   2. Every entry's "path" exists on disk (relative to repo root)
#   3. Every rule in AGENTS.md Core Rule Catalog has a rules.json entry
#   4. Every skill in AGENTS.md Skills Catalog has a rules.json entry
#   5. No orphaned entries (in rules.json but not in AGENTS.md) — warning only
#
# Exit codes:
#   0 — validation passed
#   1 — validation failed (errors found)
#
# Usage:
#   scripts/validate-rules-json.sh [--rules-json <path>] [--agents-md <path>]

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RULES_JSON="$REPO_ROOT/rules.json"
AGENTS_MD="$REPO_ROOT/AGENTS.md"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rules-json) RULES_JSON="$2"; shift 2 ;;
    --agents-md)  AGENTS_MD="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

echo "Validating: $RULES_JSON"
echo "Against:    $AGENTS_MD"
echo ""

python3 - "$RULES_JSON" "$AGENTS_MD" "$REPO_ROOT" <<'PYEOF'
import json, sys, re, os

rules_json_path = sys.argv[1]
agents_md_path  = sys.argv[2]
repo_root       = sys.argv[3]

errors = 0
warnings = 0

def error(msg):
    global errors
    print(f"  ERROR: {msg}")
    errors += 1

def warn(msg):
    global warnings
    print(f"  WARN:  {msg}")
    warnings += 1

# ----------------------------------------------------------------
# 1. rules.json must exist and be valid JSON
# ----------------------------------------------------------------
if not os.path.exists(rules_json_path):
    error(f"rules.json not found: {rules_json_path}")
    print(f"\nValidation FAILED: {errors} error(s)")
    sys.exit(1)

try:
    with open(rules_json_path, encoding='utf-8') as f:
        registry = json.load(f)
except json.JSONDecodeError as e:
    error(f"rules.json is not valid JSON: {e}")
    print(f"\nValidation FAILED: {errors} error(s)")
    sys.exit(1)

entries = registry.get('entries', [])
entry_ids = {e['id'] for e in entries}
entry_paths = {e.get('path', ''): e['id'] for e in entries}

# ----------------------------------------------------------------
# 2. Every entry's path must exist on disk
# ----------------------------------------------------------------
print("Checking file paths...")
for entry in entries:
    path = entry.get('path', '')
    if not path:
        error(f"Entry '{entry.get('id', '?')}' has no path")
        continue
    full_path = os.path.join(repo_root, path) if not os.path.isabs(path) else path
    if not os.path.exists(full_path):
        error(f"Path not found on disk: {path}  (entry: {entry.get('id', '?')})")

# ----------------------------------------------------------------
# 3 & 4. Parse AGENTS.md and check coverage
# ----------------------------------------------------------------
if not os.path.exists(agents_md_path):
    error(f"AGENTS.md not found: {agents_md_path}")
    print(f"\nValidation FAILED: {errors} error(s)")
    sys.exit(1)

with open(agents_md_path, encoding='utf-8') as f:
    content = f.read()

# Parse Core Rule Catalog
print("Checking Core Rule Catalog coverage...")
rule_section = re.search(
    r'##\s+📖\s+Core Rule Catalog(.*?)(?=##|\Z)', content, re.DOTALL
)
if rule_section:
    for m in re.finditer(r'`core/([^`]+\.mdc)`', rule_section.group(1)):
        filename = m.group(1).strip()
        rule_id = filename.replace('.mdc', '')
        if rule_id not in entry_ids:
            error(f"Rule in AGENTS.md not in rules.json: {rule_id} (rules/core/{filename})")
        else:
            pass  # covered

# Parse Skills Catalog
print("Checking Skills Catalog coverage...")
skills_section = re.search(
    r'##\s+🎨\s+Skills Catalog(.*?)(?=^##\s+⚠️|^---|\Z)', content, re.DOTALL | re.MULTILINE
)
if skills_section:
    for m in re.finditer(r'\*\*`skills/([^`]+)`\*\*', skills_section.group(1)):
        skill_dir = m.group(1).strip()
        skill_id = skill_dir
        if skill_id not in entry_ids:
            warn(f"Skill in AGENTS.md not in rules.json: {skill_id} (skills/{skill_dir}/SKILL.md)")

# ----------------------------------------------------------------
# 5. Orphaned entries (warn only)
# ----------------------------------------------------------------
print("Checking for orphaned entries...")
agents_rule_ids = set()
agents_skill_ids = set()

if rule_section:
    for m in re.finditer(r'`core/([^`]+\.mdc)`', rule_section.group(1)):
        agents_rule_ids.add(m.group(1).strip().replace('.mdc', ''))

if skills_section:
    for m in re.finditer(r'\*\*`skills/([^`]+)`\*\*', skills_section.group(1)):
        agents_skill_ids.add(m.group(1).strip())

all_agents_ids = agents_rule_ids | agents_skill_ids
for entry in entries:
    eid = entry['id']
    if eid not in all_agents_ids:
        warn(f"Orphaned entry in rules.json (not in AGENTS.md): {eid}")

# ----------------------------------------------------------------
# Summary
# ----------------------------------------------------------------
print("")
total = len(entries)
print(f"Entries checked: {total} ({len([e for e in entries if e.get('type')=='rule'])} rules, {len([e for e in entries if e.get('type')=='skill'])} skills)")

if errors > 0:
    print(f"\nValidation FAILED: {errors} error(s), {warnings} warning(s)")
    sys.exit(1)
elif warnings > 0:
    print(f"\nValidation PASSED with {warnings} warning(s)")
else:
    print(f"\nValidation PASSED: all {total} entries are valid")
PYEOF
