import matter from 'gray-matter';

export interface SkillFrontmatter {
  name: string;
  description: string;
  triggers?: {
    keywords?: string[];
    patterns?: string[];
    paths?: string[];
  };
  metadata?: {
    version?: string;
    category?: string;
    agent_worthy?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface RuleFrontmatter {
  description?: string;
  globs?: string[];
  alwaysApply?: boolean;
  [key: string]: unknown;
}

export function parseSkillFrontmatter(content: string): { data: SkillFrontmatter; content: string } {
  const parsed = matter(content);
  return { data: parsed.data as SkillFrontmatter, content: parsed.content };
}

export function parseRuleFrontmatter(content: string): { data: RuleFrontmatter; content: string } {
  const parsed = matter(content);
  return { data: parsed.data as RuleFrontmatter, content: parsed.content };
}

export function hasFrontmatter(content: string): boolean {
  return content.trimStart().startsWith('---');
}
