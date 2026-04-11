import { describe, it, expect } from 'bun:test';
import { hasFrontmatter, parseSkillFrontmatter, parseRuleFrontmatter } from '../../src/shared/frontmatter';

const SKILL_CONTENT = `---
name: test-skill
description: "Use when testing something"
version: "1.0.0"
metadata:
  agent_worthy: true
  model: claude-opus-4-6
---
# Test Skill
This is the body.`;

const RULE_CONTENT = `---
description: "Git workflow rules"
globs:
  - "**/*.ts"
  - "**/*.js"
alwaysApply: false
---
# Git Rules
Follow these conventions.`;

describe('hasFrontmatter', () => {
  it('content starting with --- returns true', () => {
    expect(hasFrontmatter('---\nname: foo\n---\nbody')).toBe(true);
  });

  it('content without frontmatter returns false', () => {
    expect(hasFrontmatter('# no frontmatter')).toBe(false);
  });

  it('empty string returns false', () => {
    expect(hasFrontmatter('')).toBe(false);
  });

  it('content with leading whitespace and --- returns true', () => {
    expect(hasFrontmatter('  ---\nname: foo\n---\nbody')).toBe(true);
  });

  it('content starting with other characters returns false', () => {
    expect(hasFrontmatter('name: foo\n---\nbody')).toBe(false);
  });
});

describe('parseSkillFrontmatter', () => {
  it('parses name correctly', () => {
    const { data } = parseSkillFrontmatter(SKILL_CONTENT);
    expect(data.name).toBe('test-skill');
  });

  it('parses description correctly', () => {
    const { data } = parseSkillFrontmatter(SKILL_CONTENT);
    expect(data.description).toBe('Use when testing something');
  });

  it('parses version from top-level', () => {
    const { data } = parseSkillFrontmatter(SKILL_CONTENT);
    expect(data.version).toBe('1.0.0');
  });

  it('parses metadata.agent_worthy: true', () => {
    const { data } = parseSkillFrontmatter(SKILL_CONTENT);
    expect(data.metadata?.agent_worthy).toBe(true);
  });

  it('parses metadata.model', () => {
    const { data } = parseSkillFrontmatter(SKILL_CONTENT);
    expect(data.metadata?.model).toBe('claude-opus-4-6');
  });

  it('extracts body content correctly', () => {
    const { content } = parseSkillFrontmatter(SKILL_CONTENT);
    expect(content.trim()).toBe('# Test Skill\nThis is the body.');
  });

  it('parses skill with triggers', () => {
    const input = `---
name: trigger-skill
description: "A skill with triggers"
triggers:
  keywords:
    - commit
    - push
  patterns:
    - "git.*"
---
Body content`;
    const { data } = parseSkillFrontmatter(input);
    expect(data.name).toBe('trigger-skill');
    expect(data.triggers?.keywords).toEqual(['commit', 'push']);
    expect(data.triggers?.patterns).toEqual(['git.*']);
  });
});

describe('parseRuleFrontmatter', () => {
  it('parses description correctly', () => {
    const { data } = parseRuleFrontmatter(RULE_CONTENT);
    expect(data.description).toBe('Git workflow rules');
  });

  it('parses globs array correctly', () => {
    const { data } = parseRuleFrontmatter(RULE_CONTENT);
    expect(data.globs).toEqual(['**/*.ts', '**/*.js']);
  });

  it('parses alwaysApply: false', () => {
    const { data } = parseRuleFrontmatter(RULE_CONTENT);
    expect(data.alwaysApply).toBe(false);
  });

  it('parses alwaysApply: true', () => {
    const input = `---
description: "Always applied rule"
alwaysApply: true
---
Rule body`;
    const { data } = parseRuleFrontmatter(input);
    expect(data.alwaysApply).toBe(true);
  });

  it('extracts body content correctly', () => {
    const { content } = parseRuleFrontmatter(RULE_CONTENT);
    expect(content.trim()).toBe('# Git Rules\nFollow these conventions.');
  });

  it('handles rule with no globs', () => {
    const input = `---
description: "Simple rule"
alwaysApply: true
---
Body`;
    const { data } = parseRuleFrontmatter(input);
    expect(data.globs).toBeUndefined();
    expect(data.description).toBe('Simple rule');
  });
});
