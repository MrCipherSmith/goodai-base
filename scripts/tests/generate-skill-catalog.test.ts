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

const SCRIPT = join(import.meta.dir, '..', 'src', 'generate-skill-catalog.ts');

function makeFixture(suffix: string): string {
  const base = join(tmpdir(), `skill-catalog-test-${suffix}-${Date.now()}`);
  mkdirSync(join(base, 'skills', 'test-skill-a'), { recursive: true });
  mkdirSync(join(base, 'skills', 'test-skill-b'), { recursive: true });
  mkdirSync(join(base, 'docs'), { recursive: true });
  return base;
}

const SKILL_A_MD = `---
name: test-skill-a
description: "Use when testing skill A"
version: "1.2.0"
metadata:
  category: testing
---
# Test Skill A
Body content here.
`;

const SKILL_B_MD = `---
name: test-skill-b
description: "Use when testing skill B"
version: "2.0.0"
metadata:
  category: validation
---
# Test Skill B
More body content.
`;

describe('generate-skill-catalog.ts', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = makeFixture('main');
    writeFileSync(join(tmpDir, 'skills', 'test-skill-a', 'SKILL.md'), SKILL_A_MD);
    writeFileSync(join(tmpDir, 'skills', 'test-skill-b', 'SKILL.md'), SKILL_B_MD);
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exits 0 with valid skills directory', () => {
    const { exitCode } = runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    expect(exitCode).toBe(0);
  });

  it('creates docs/skill-catalog.md', () => {
    runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    expect(existsSync(join(tmpDir, 'docs', 'skill-catalog.md'))).toBe(true);
  });

  it('creates docs/ai/skill-catalog.yaml', () => {
    runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    expect(existsSync(join(tmpDir, 'docs', 'ai', 'skill-catalog.yaml'))).toBe(true);
  });

  it('markdown catalog contains skill names in table rows', () => {
    runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    const content = readFileSync(join(tmpDir, 'docs', 'skill-catalog.md'), 'utf8');
    expect(content).toContain('test-skill-a');
    expect(content).toContain('test-skill-b');
  });

  it('markdown catalog contains # Skill Catalog header', () => {
    runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    const content = readFileSync(join(tmpDir, 'docs', 'skill-catalog.md'), 'utf8');
    expect(content).toContain('# Skill Catalog');
  });

  it('YAML catalog contains name: test-skill-a', () => {
    runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    const content = readFileSync(join(tmpDir, 'docs', 'ai', 'skill-catalog.yaml'), 'utf8');
    expect(content).toContain('name: test-skill-a');
  });

  it('YAML catalog has skills: key (valid YAML structure)', () => {
    runScript(SCRIPT, [
      '--skills-dir', join(tmpDir, 'skills'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    const content = readFileSync(join(tmpDir, 'docs', 'ai', 'skill-catalog.yaml'), 'utf8');
    expect(content).toContain('skills:');
  });

  it('handles skills with missing optional fields (no version, no category)', () => {
    const base = join(tmpdir(), `skill-catalog-minimal-${Date.now()}`);
    mkdirSync(join(base, 'skills', 'minimal-skill'), { recursive: true });
    mkdirSync(join(base, 'docs'), { recursive: true });
    writeFileSync(
      join(base, 'skills', 'minimal-skill', 'SKILL.md'),
      `---\nname: minimal-skill\ndescription: "A minimal skill"\n---\n# Minimal\n`,
    );
    const { exitCode } = runScript(SCRIPT, [
      '--skills-dir', join(base, 'skills'),
      '--output-dir', join(base, 'docs'),
    ]);
    expect(exitCode).toBe(0);
    const mdContent = readFileSync(join(base, 'docs', 'skill-catalog.md'), 'utf8');
    expect(mdContent).toContain('minimal-skill');
    // Missing version and category should use fallback dash
    expect(mdContent).toContain('—');
    rmSync(base, { recursive: true, force: true });
  });

  it('handles empty skills directory — exits 0, catalog header present', () => {
    const base = join(tmpdir(), `skill-catalog-empty-${Date.now()}`);
    mkdirSync(join(base, 'skills'), { recursive: true });
    mkdirSync(join(base, 'docs'), { recursive: true });
    const { exitCode } = runScript(SCRIPT, [
      '--skills-dir', join(base, 'skills'),
      '--output-dir', join(base, 'docs'),
    ]);
    expect(exitCode).toBe(0);
    const mdContent = readFileSync(join(base, 'docs', 'skill-catalog.md'), 'utf8');
    expect(mdContent).toContain('# Skill Catalog');
    expect(mdContent).toContain('Total: 0 skills');
    rmSync(base, { recursive: true, force: true });
  });

  it('exits non-zero when skills directory does not exist', () => {
    const { exitCode, stderr } = runScript(SCRIPT, [
      '--skills-dir', '/nonexistent/path/skills',
      '--output-dir', '/tmp/nowhere',
    ]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('ERROR');
  });

  it('dry-run does not write files', () => {
    const base = join(tmpdir(), `skill-catalog-dryrun-${Date.now()}`);
    mkdirSync(join(base, 'skills', 'some-skill'), { recursive: true });
    mkdirSync(join(base, 'docs'), { recursive: true });
    writeFileSync(
      join(base, 'skills', 'some-skill', 'SKILL.md'),
      `---\nname: some-skill\ndescription: "A skill"\n---\n`,
    );
    const { exitCode, stdout } = runScript(SCRIPT, [
      '--skills-dir', join(base, 'skills'),
      '--output-dir', join(base, 'docs'),
      '--dry-run',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('DRY RUN');
    expect(existsSync(join(base, 'docs', 'skill-catalog.md'))).toBe(false);
    expect(existsSync(join(base, 'docs', 'ai', 'skill-catalog.yaml'))).toBe(false);
    rmSync(base, { recursive: true, force: true });
  });
});
