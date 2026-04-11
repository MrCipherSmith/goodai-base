import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Helper to run a script
function runScript(
  scriptPath: string,
  args: string[] = [],
  cwd?: string,
): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync(['bun', scriptPath, ...args], {
    cwd: cwd ?? join(import.meta.dir, '..'),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode ?? 1,
  };
}

const SCRIPT = join(import.meta.dir, '..', 'src', 'generate-skill-registry.ts');

const SKILL_A_MD = `---
name: skill-alpha
description: "Use when testing skill alpha workflows"
triggers:
  keywords:
    - alpha
    - testing
    - workflow
  patterns: []
  paths: []
metadata:
  category: testing
---
# Skill Alpha
Body content.
`;

const SKILL_B_MD = `---
name: skill-beta
description: "Use when reviewing beta code"
triggers:
  keywords:
    - review
    - beta
    - code
  patterns: []
  paths: []
---
# Skill Beta
Body content.
`;

// Skill with hook_config in metadata
const SKILL_HOOK_MD = `---
name: skill-with-hook
description: "Use when hook configuration is needed"
metadata:
  hook_config:
    enabled: true
    maxSuggestions: 5
    globalMinScore: 3
    wholeWordMatch: true
---
# Skill With Hook
Body.
`;

// Skill with no description
const SKILL_NO_DESC_MD = `---
name: skill-no-desc
---
# No Description Skill
Just a skill with no description field.
`;

function makeSkillsDir(suffix: string, skills: Record<string, string>): string {
  const base = join(tmpdir(), `skill-registry-${suffix}-${Date.now()}`);
  for (const [dirName, content] of Object.entries(skills)) {
    mkdirSync(join(base, 'skills', dirName), { recursive: true });
    writeFileSync(join(base, 'skills', dirName, 'SKILL.md'), content);
  }
  mkdirSync(join(base, 'hooks'), { recursive: true });
  return base;
}

describe('generate-skill-registry.ts', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = makeSkillsDir('main', {
      'skill-alpha': SKILL_A_MD,
      'skill-beta': SKILL_B_MD,
    });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exits 0 with valid skills directory', () => {
    const { exitCode } = runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output', join(tmpDir, 'hooks', 'skill-registry.json'),
    ]);
    expect(exitCode).toBe(0);
  });

  it('creates skill-registry.json', () => {
    runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output', join(tmpDir, 'hooks', 'skill-registry.json'),
    ]);
    expect(existsSync(join(tmpDir, 'hooks', 'skill-registry.json'))).toBe(true);
  });

  it('registry has correct top-level structure (version, generated_from, hookConfig, skills)', () => {
    runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output', join(tmpDir, 'hooks', 'skill-registry.json'),
    ]);
    const json = JSON.parse(readFileSync(join(tmpDir, 'hooks', 'skill-registry.json'), 'utf8'));
    expect(typeof json.version).toBe('string');
    expect(typeof json.generated_from).toBe('string');
    expect(typeof json.hookConfig).toBe('object');
    expect(Array.isArray(json.skills)).toBe(true);
  });

  it('each skill entry has name, description, keywords, patterns, paths, minScore', () => {
    runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output', join(tmpDir, 'hooks', 'skill-registry.json'),
    ]);
    const json = JSON.parse(readFileSync(join(tmpDir, 'hooks', 'skill-registry.json'), 'utf8'));
    for (const entry of json.skills) {
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.description).toBe('string');
      expect(Array.isArray(entry.keywords)).toBe(true);
      expect(Array.isArray(entry.patterns)).toBe(true);
      expect(Array.isArray(entry.paths)).toBe(true);
      expect(typeof entry.minScore).toBe('number');
    }
  });

  it('skill entries from frontmatter keywords are populated', () => {
    runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output', join(tmpDir, 'hooks', 'skill-registry.json'),
    ]);
    const json = JSON.parse(readFileSync(join(tmpDir, 'hooks', 'skill-registry.json'), 'utf8'));
    const alpha = json.skills.find((s: { name: string }) => s.name === 'skill-alpha');
    expect(alpha).toBeDefined();
    expect(alpha.keywords).toContain('alpha');
    expect(alpha.keywords).toContain('testing');
    expect(alpha.keywords).toContain('workflow');
  });

  it('registry contains correct count of skills', () => {
    runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output', join(tmpDir, 'hooks', 'skill-registry.json'),
    ]);
    const json = JSON.parse(readFileSync(join(tmpDir, 'hooks', 'skill-registry.json'), 'utf8'));
    expect(json.skills.length).toBe(2);
  });

  it('skills with metadata.hook_config preserve that config in the entry', () => {
    const base = makeSkillsDir('hook-cfg', { 'skill-with-hook': SKILL_HOOK_MD });

    // First run — generate initial registry
    runScript(SCRIPT, [
      '--skills-dir', join(base, 'skills'),
      '--output', join(base, 'hooks', 'skill-registry.json'),
    ]);

    // Inject hookConfig into the existing registry entry (simulating previous run that wrote it)
    const json = JSON.parse(readFileSync(join(base, 'hooks', 'skill-registry.json'), 'utf8'));
    const entry = json.skills.find((s: { name: string }) => s.name === 'skill-with-hook');
    expect(entry).toBeDefined();
    entry.hookConfig = {
      enabled: true,
      maxSuggestions: 5,
      globalMinScore: 3,
      wholeWordMatch: true,
    };
    writeFileSync(join(base, 'hooks', 'skill-registry.json'), JSON.stringify(json, null, 2) + '\n');

    // Second run — re-generate
    runScript(SCRIPT, [
      '--skills-dir', join(base, 'skills'),
      '--output', join(base, 'hooks', 'skill-registry.json'),
    ]);

    // hookConfig should be preserved from existing entry
    const json2 = JSON.parse(readFileSync(join(base, 'hooks', 'skill-registry.json'), 'utf8'));
    const entry2 = json2.skills.find((s: { name: string }) => s.name === 'skill-with-hook');
    expect(entry2).toBeDefined();
    expect(entry2.hookConfig).toBeDefined();
    expect(entry2.hookConfig.maxSuggestions).toBe(5);
    expect(entry2.hookConfig.globalMinScore).toBe(3);
    rmSync(base, { recursive: true, force: true });
  });

  it('skills missing description are handled gracefully — still included with empty description', () => {
    const base = makeSkillsDir('no-desc', { 'skill-no-desc': SKILL_NO_DESC_MD });
    const { exitCode } = runScript(SCRIPT, [
      '--skills-dir', join(base, 'skills'),
      '--output', join(base, 'hooks', 'skill-registry.json'),
    ]);
    expect(exitCode).toBe(0);
    const json = JSON.parse(readFileSync(join(base, 'hooks', 'skill-registry.json'), 'utf8'));
    const entry = json.skills.find((s: { name: string }) => s.name === 'skill-no-desc');
    expect(entry).toBeDefined();
    expect(typeof entry.description).toBe('string');
    rmSync(base, { recursive: true, force: true });
  });

  it('exits non-zero when skills directory does not exist', () => {
    const { exitCode, stderr } = runScript(SCRIPT, [
      '--skills-dir', '/nonexistent/skills',
      '--output', '/tmp/skill-registry.json',
    ]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('ERROR');
  });

  it('keywords are derived from description when no triggers block is present', () => {
    const base = makeSkillsDir('derived-kw', {
      'derived-skill': `---\nname: derived-skill\ndescription: "Use when deploying kubernetes containers"\n---\n# Derived\n`,
    });
    runScript(SCRIPT, [
      '--skills-dir', join(base, 'skills'),
      '--output', join(base, 'hooks', 'skill-registry.json'),
    ]);
    const json = JSON.parse(readFileSync(join(base, 'hooks', 'skill-registry.json'), 'utf8'));
    const entry = json.skills.find((s: { name: string }) => s.name === 'derived-skill');
    expect(entry).toBeDefined();
    // Keywords should be derived from "deploying kubernetes containers"
    // Stop words ("when", "use") filtered out
    expect(entry.keywords.length).toBeGreaterThan(0);
    expect(entry.keywords).not.toContain('when');
    expect(entry.keywords).not.toContain('use');
    rmSync(base, { recursive: true, force: true });
  });

  it('handles empty skills directory — exits 0, empty skills array', () => {
    const base = join(tmpdir(), `skill-registry-empty-${Date.now()}`);
    mkdirSync(join(base, 'skills'), { recursive: true });
    mkdirSync(join(base, 'hooks'), { recursive: true });
    const { exitCode } = runScript(SCRIPT, [
      '--skills-dir', join(base, 'skills'),
      '--output', join(base, 'hooks', 'skill-registry.json'),
    ]);
    expect(exitCode).toBe(0);
    const json = JSON.parse(readFileSync(join(base, 'hooks', 'skill-registry.json'), 'utf8'));
    expect(json.skills).toEqual([]);
    rmSync(base, { recursive: true, force: true });
  });
});
