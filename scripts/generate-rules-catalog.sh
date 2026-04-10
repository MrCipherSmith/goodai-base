#!/usr/bin/env bash
# generate-rules-catalog.sh — Generate rules catalog from rules/core/*.mdc
#
# Reads all rules/core/*.mdc files, extracts frontmatter (description, alwaysApply)
# and derives the "area" from the filename convention. Writes:
#   docs/rules-catalog.md — Markdown table (rule | description | area | always-apply)
#
# Usage:
#   scripts/generate-rules-catalog.sh [--rules-dir <path>] [--output-dir <path>] [--dry-run]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RULES_DIR="$REPO_ROOT/rules/core"
OUTPUT_DIR="$REPO_ROOT/docs"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rules-dir)  RULES_DIR="$2"; shift 2 ;;
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    --dry-run)    DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ ! -d "$RULES_DIR" ]]; then
  echo "ERROR: rules directory not found: $RULES_DIR" >&2
  exit 1
fi

echo "Scanning: $RULES_DIR"
[[ "$DRY_RUN" == "true" ]] && echo "(DRY RUN — no files written)"

python3 - "$RULES_DIR" "$OUTPUT_DIR" "$DRY_RUN" <<'PYEOF'
import os, sys, re

rules_dir  = sys.argv[1]
output_dir = sys.argv[2]
dry_run    = sys.argv[3] == "true"

# Area inference from filename prefixes/keywords
AREA_MAP = {
    'code-style':     'TypeScript / React',
    'code-review':    'Code Review',
    'commit':         'Git',
    'git':            'Git',
    'frontend':       'Frontend',
    'mobx':           'MobX / State',
    'nestjs':         'Backend / NestJS',
    'storybook':      'Storybook',
    'playwright':     'Testing',
    'test':           'Testing',
    'documentation':  'Documentation',
    'docs':           'Documentation',
    'jobs':           'Orchestration',
    'pipeline':       'Orchestration',
    'beads':          'Orchestration',
    'skills':         'Skills',
    'rule':           'Meta',
    'requirements':   'Planning',
    'implementation': 'Planning',
    'model':          'AI / Models',
    'security':       'Security',
    'perf':           'Performance',
}

def infer_area(filename):
    """Derive area label from .mdc filename."""
    name = filename.replace('.mdc', '').lower()
    for prefix, area in AREA_MAP.items():
        if name.startswith(prefix) or prefix in name:
            return area
    return 'General'

def extract_frontmatter(path):
    """Extract description and alwaysApply from .mdc YAML frontmatter."""
    try:
        with open(path, encoding='utf-8') as f:
            lines = f.readlines()
    except OSError:
        return None

    if not lines or lines[0].strip() != '---':
        return None

    fm_lines = []
    for line in lines[1:]:
        if line.strip() == '---':
            break
        fm_lines.append(line)

    fm = ''.join(fm_lines)

    def get_field(pattern, text):
        m = re.search(pattern, text, re.MULTILINE)
        return m.group(1).strip().strip('"\'') if m else ''

    description  = get_field(r'^description:\s*(.+)', fm)
    always_apply = get_field(r'^alwaysApply:\s*(.+)', fm)

    return {
        'description':  description,
        'always_apply': always_apply.lower() == 'true',
    }

entries = []

for filename in sorted(os.listdir(rules_dir)):
    if not filename.endswith('.mdc'):
        continue
    full_path = os.path.join(rules_dir, filename)
    rule_id   = filename.replace('.mdc', '')
    data      = extract_frontmatter(full_path) or {}

    description  = data.get('description', '—')
    always_apply = data.get('always_apply', False)
    area         = infer_area(filename)

    entries.append({
        'rule':         rule_id,
        'description':  description,
        'area':         area,
        'always_apply': always_apply,
        'path':         f"rules/core/{filename}",
    })

print(f"Found {len(entries)} rules")

# ----------------------------------------------------------------
# docs/rules-catalog.md
# ----------------------------------------------------------------
md_lines = [
    "# Rules Catalog",
    "",
    "_Auto-generated from `rules/core/*.mdc`. Do not edit manually._",
    "",
    f"Total: {len(entries)} rules",
    "",
    "| Rule | Description | Area | Always Applied |",
    "| ---- | ----------- | ---- | -------------- |",
]
for e in entries:
    desc = e['description']
    if len(desc) > 100:
        desc = desc[:97] + '...'
    desc = desc.replace('|', '\\|')
    always = 'Yes' if e['always_apply'] else 'No'
    md_lines.append(f"| `{e['rule']}` | {desc} | {e['area']} | {always} |")

md_content = '\n'.join(md_lines) + '\n'

# ----------------------------------------------------------------
# Write output
# ----------------------------------------------------------------
md_path = os.path.join(output_dir, 'rules-catalog.md')

if dry_run:
    print(f"\n[DRY RUN] Would write: {md_path}")
else:
    os.makedirs(output_dir, exist_ok=True)
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    print(f"Written: {md_path}")

PYEOF
