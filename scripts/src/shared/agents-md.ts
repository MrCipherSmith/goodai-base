export interface AgentsMdRule {
  path: string;
  description: string;
}

export interface AgentsMdSkill {
  name: string;
  path: string;
  description: string;
}

export interface AgentsMdData {
  rules: AgentsMdRule[];
  skills: AgentsMdSkill[];
}

export function parseAgentsMd(content: string): AgentsMdData {
  const rules: AgentsMdRule[] = [];
  const skills: AgentsMdSkill[] = [];

  // Parse Core Rule Catalog section
  const ruleSectionMatch = content.match(/##\s+📖\s+Core Rule Catalog([\s\S]*?)(?=\n##\s|$)/);
  if (ruleSectionMatch?.[1]) {
    const ruleSection = ruleSectionMatch[1];
    // Match lines like: - `core/filename.mdc` — description
    const rulePattern = /`core\/([^`]+\.mdc)`[^—–-]*[—–-]\s*(.+)/g;
    let match;
    while ((match = rulePattern.exec(ruleSection)) !== null) {
      rules.push({
        path: `rules/core/${match[1]}`,
        description: match[2]!.trim(),
      });
    }
  }

  // Parse Skills Catalog section
  const skillSectionMatch = content.match(/##\s+🎨\s+Skills Catalog([\s\S]*?)(?=\n##\s|$)/);
  if (skillSectionMatch?.[1]) {
    const skillSection = skillSectionMatch[1];
    // Match skill name blocks: **`skills/name`** (possibly multi-line)
    const skillBlockPattern = /\*\*`skills\/([^`]+)`\*\*[^\n]*\n(?:[^*\n]*\n)*?[^\n]*(?:Purpose|Use when)[^\n]*:\s*([^\n]+)/g;
    let match;
    while ((match = skillBlockPattern.exec(skillSection)) !== null) {
      skills.push({
        name: match[1]!,
        path: `skills/${match[1]}`,
        description: match[2]!.trim(),
      });
    }
  }

  return { rules, skills };
}
