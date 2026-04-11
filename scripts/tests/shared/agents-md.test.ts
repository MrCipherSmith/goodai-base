import { describe, it, expect } from 'bun:test';
import { parseAgentsMd } from '../../src/shared/agents-md';

// Note: the rule pattern only matches .mdc files (not .md)
// The skill pattern matches lines with "Purpose:" or "Use when" followed by a colon
const SAMPLE_AGENTS_MD = `## 📖 Core Rule Catalog

- \`core/git-rules.mdc\`: Git workflow rules
- \`core/review-profile.mdc\` — Code review standards
- \`core/subagent-status-protocol.md\`: Subagent status reporting

## 🎨 Skills Catalog

**\`skills/commit\`** · commit skill
Use when: creating commits

  Purpose: Use when committing changes

**\`skills/code-review\`**
  Use when code review is needed: full PR review
`;

describe('parseAgentsMd', () => {
  describe('rules parsing', () => {
    it('parses rules with colon separator', () => {
      const { rules } = parseAgentsMd(SAMPLE_AGENTS_MD);
      const gitRule = rules.find(r => r.path === 'rules/core/git-rules.mdc');
      expect(gitRule).toBeDefined();
      expect(gitRule!.description).toBe('Git workflow rules');
    });

    it('parses rules with em-dash separator', () => {
      const { rules } = parseAgentsMd(SAMPLE_AGENTS_MD);
      const reviewRule = rules.find(r => r.path === 'rules/core/review-profile.mdc');
      expect(reviewRule).toBeDefined();
      expect(reviewRule!.description).toBe('Code review standards');
    });

    it('only .mdc files are matched (not .md)', () => {
      // subagent-status-protocol.md uses .md extension, so it is NOT matched
      const { rules } = parseAgentsMd(SAMPLE_AGENTS_MD);
      const mdRule = rules.find(r => r.path.includes('subagent-status-protocol'));
      expect(mdRule).toBeUndefined();
    });

    it('count: sample has 2 matching rules (only .mdc files)', () => {
      const { rules } = parseAgentsMd(SAMPLE_AGENTS_MD);
      expect(rules).toHaveLength(2);
    });

    it('rules have correct path format (rules/core/...)', () => {
      const { rules } = parseAgentsMd(SAMPLE_AGENTS_MD);
      for (const rule of rules) {
        expect(rule.path.startsWith('rules/core/')).toBe(true);
      }
    });
  });

  describe('skills parsing', () => {
    it('parses commit skill name', () => {
      const { skills } = parseAgentsMd(SAMPLE_AGENTS_MD);
      const commitSkill = skills.find(s => s.name === 'commit');
      expect(commitSkill).toBeDefined();
    });

    it('parses commit skill path', () => {
      const { skills } = parseAgentsMd(SAMPLE_AGENTS_MD);
      const commitSkill = skills.find(s => s.name === 'commit');
      expect(commitSkill!.path).toBe('skills/commit');
    });

    it('parses commit skill description from "Use when:" line', () => {
      const { skills } = parseAgentsMd(SAMPLE_AGENTS_MD);
      const commitSkill = skills.find(s => s.name === 'commit');
      expect(commitSkill!.description).toBe('creating commits');
    });

    it('parses code-review skill', () => {
      const { skills } = parseAgentsMd(SAMPLE_AGENTS_MD);
      const reviewSkill = skills.find(s => s.name === 'code-review');
      expect(reviewSkill).toBeDefined();
      expect(reviewSkill!.path).toBe('skills/code-review');
    });

    it('parses code-review skill description from "Use when" line', () => {
      const { skills } = parseAgentsMd(SAMPLE_AGENTS_MD);
      const reviewSkill = skills.find(s => s.name === 'code-review');
      expect(reviewSkill!.description).toBe('full PR review');
    });

    it('count: sample has 2 skills', () => {
      const { skills } = parseAgentsMd(SAMPLE_AGENTS_MD);
      expect(skills).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('empty AGENTS.md returns { rules: [], skills: [] }', () => {
      const result = parseAgentsMd('');
      expect(result.rules).toEqual([]);
      expect(result.skills).toEqual([]);
    });

    it('missing rule section returns rules: []', () => {
      const content = `## 🎨 Skills Catalog

**\`skills/commit\`** · commit skill
  Purpose: Use when committing changes
`;
      const { rules } = parseAgentsMd(content);
      expect(rules).toEqual([]);
    });

    it('missing skills section returns skills: []', () => {
      const content = `## 📖 Core Rule Catalog

- \`core/git-rules.mdc\`: Git workflow rules
`;
      const { skills } = parseAgentsMd(content);
      expect(skills).toEqual([]);
    });

    it('content with no matching patterns returns empty arrays', () => {
      const result = parseAgentsMd('# Just a heading\n\nSome text here.');
      expect(result.rules).toEqual([]);
      expect(result.skills).toEqual([]);
    });

    it('single rule with colon separator', () => {
      const content = `## 📖 Core Rule Catalog

- \`core/single-rule.mdc\`: A single rule description
`;
      const { rules } = parseAgentsMd(content);
      expect(rules).toHaveLength(1);
      expect(rules[0]!.path).toBe('rules/core/single-rule.mdc');
      expect(rules[0]!.description).toBe('A single rule description');
    });

    it('single skill with Purpose line', () => {
      const content = `## 🎨 Skills Catalog

**\`skills/my-skill\`** · my skill
  Purpose: Do something useful
`;
      const { skills } = parseAgentsMd(content);
      expect(skills).toHaveLength(1);
      expect(skills[0]!.name).toBe('my-skill');
      expect(skills[0]!.path).toBe('skills/my-skill');
    });
  });
});
