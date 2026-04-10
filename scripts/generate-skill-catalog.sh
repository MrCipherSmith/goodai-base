#!/usr/bin/env bash
# generate-skill-catalog.sh — Generate skill catalog from skills/*/SKILL.md
#
# Reads all skills/*/SKILL.md files, extracts YAML frontmatter fields
# (name, description, metadata.version, metadata.category), and writes:
#   docs/skill-catalog.md  — Markdown table for humans
#   docs/ai/skill-catalog.yaml — Machine-readable YAML for hook consumption
#
# Usage:
#   scripts/generate-skill-catalog.sh [--skills-dir <path>] [--output-dir <path>] [--dry-run]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"
OUTPUT_DIR="$REPO_ROOT/docs"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skills-dir) SKILLS_DIR="$2"; shift 2 ;;
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    --dry-run)    DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "ERROR: skills directory not found: $SKILLS_DIR" >&2
  exit 1
fi

echo "Scanning: $SKILLS_DIR"
[[ "$DRY_RUN" == "true" ]] && echo "(DRY RUN — no files written)"

python3 - "$SKILLS_DIR" "$OUTPUT_DIR" "$DRY_RUN" <<'PYEOF'
import os, sys, re

skills_dir = sys.argv[1]
output_dir = sys.argv[2]
dry_run    = sys.argv[3] == "true"

SKIP_DIRS = {"shared"}

def extract_frontmatter(path):
    """Extract YAML frontmatter fields from a SKILL.md file."""
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
        if not m:
            return ''
        val = m.group(1).strip().strip('"\'')
        return val

    name        = get_field(r'^name:\s*(.+)', fm)
    description = get_field(r'^description:\s*(.+)', fm)

    # metadata block: indented under "metadata:"
    meta_block = ''
    in_meta = False
    for line in fm_lines:
        if re.match(r'^metadata:', line):
            in_meta = True
            continue
        if in_meta:
            if re.match(r'^\S', line):
                break
            meta_block += line

    version  = get_field(r'version:\s*(.+)', meta_block)
    category = get_field(r'category:\s*(.+)', meta_block)

    return {
        'name':        name or os.path.basename(os.path.dirname(path)),
        'description': description,
        'version':     version or '—',
        'category':    category or '—',
        'path':        f"skills/{os.path.basename(os.path.dirname(path))}",
    }

entries = []

for skill_dir in sorted(os.listdir(skills_dir)):
    if skill_dir in SKIP_DIRS:
        continue
    full_dir = os.path.join(skills_dir, skill_dir)
    if not os.path.isdir(full_dir):
        continue
    skill_md = os.path.join(full_dir, 'SKILL.md')
    if not os.path.isfile(skill_md):
        continue
    data = extract_frontmatter(skill_md)
    if data:
        entries.append(data)

print(f"Found {len(entries)} skills")

# ----------------------------------------------------------------
# docs/skill-catalog.md
# ----------------------------------------------------------------
md_lines = [
    "# Skill Catalog",
    "",
    f"_Auto-generated from `skills/*/SKILL.md`. Do not edit manually._",
    "",
    f"Total: {len(entries)} skills",
    "",
    "| Name | Description | Version | Category |",
    "| ---- | ----------- | ------- | -------- |",
]
for e in entries:
    desc = e['description']
    # Truncate long descriptions for table readability
    if len(desc) > 100:
        desc = desc[:97] + '...'
    # Escape pipes in description
    desc = desc.replace('|', '\\|')
    md_lines.append(f"| `{e['name']}` | {desc} | {e['version']} | {e['category']} |")

md_content = '\n'.join(md_lines) + '\n'

# ----------------------------------------------------------------
# docs/ai/skill-catalog.yaml
# ----------------------------------------------------------------
yaml_lines = [
    "# Machine-readable skill catalog for hook/agent consumption",
    f"# Auto-generated from skills/*/SKILL.md — do not edit manually",
    "skills:",
]
for e in entries:
    # Escape description for YAML single-quoted scalar
    desc_escaped = e['description'].replace("'", "''")
    yaml_lines.append(f"  - name: {e['name']}")
    yaml_lines.append(f"    description: '{desc_escaped}'")
    yaml_lines.append(f"    version: {e['version']}")
    yaml_lines.append(f"    category: {e['category']}")
    yaml_lines.append(f"    path: {e['path']}")

yaml_content = '\n'.join(yaml_lines) + '\n'

# ----------------------------------------------------------------
# Write outputs
# ----------------------------------------------------------------
md_path   = os.path.join(output_dir, 'skill-catalog.md')
yaml_dir  = os.path.join(output_dir, 'ai')
yaml_path = os.path.join(yaml_dir, 'skill-catalog.yaml')

if dry_run:
    print(f"\n[DRY RUN] Would write: {md_path}")
    print(f"[DRY RUN] Would write: {yaml_path}")
else:
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(yaml_dir, exist_ok=True)

    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    print(f"Written: {md_path}")

    with open(yaml_path, 'w', encoding='utf-8') as f:
        f.write(yaml_content)
    print(f"Written: {yaml_path}")

PYEOF
