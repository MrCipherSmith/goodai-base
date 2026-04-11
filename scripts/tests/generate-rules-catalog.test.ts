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

const SCRIPT = join(import.meta.dir, '..', 'src', 'generate-rules-catalog.ts');

const RULE_WITH_FRONTMATTER = `---
description: A test rule for validating things
globs: ["*.ts"]
alwaysApply: false
---
# Test Rule
Content here.
`;

const RULE_NO_FRONTMATTER = `# Plain Rule
This rule has no frontmatter at all.
Just plain content.
`;

describe('generate-rules-catalog.ts', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(tmpdir(), `rules-catalog-test-${Date.now()}`);
    mkdirSync(join(tmpDir, 'rules', 'core'), { recursive: true });
    mkdirSync(join(tmpDir, 'docs'), { recursive: true });
    writeFileSync(join(tmpDir, 'rules', 'core', 'test-rule.mdc'), RULE_WITH_FRONTMATTER);
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exits 0 with valid rules directory', () => {
    const { exitCode } = runScript(SCRIPT, [
      '--rules-dir', join(tmpDir, 'rules', 'core'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    expect(exitCode).toBe(0);
  });

  it('creates docs/rules-catalog.md', () => {
    runScript(SCRIPT, [
      '--rules-dir', join(tmpDir, 'rules', 'core'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    expect(existsSync(join(tmpDir, 'docs', 'rules-catalog.md'))).toBe(true);
  });

  it('output file contains rule description', () => {
    runScript(SCRIPT, [
      '--rules-dir', join(tmpDir, 'rules', 'core'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    const content = readFileSync(join(tmpDir, 'docs', 'rules-catalog.md'), 'utf8');
    expect(content).toContain('A test rule for validating things');
  });

  it('output file contains rule filename/path reference', () => {
    runScript(SCRIPT, [
      '--rules-dir', join(tmpDir, 'rules', 'core'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    const content = readFileSync(join(tmpDir, 'docs', 'rules-catalog.md'), 'utf8');
    expect(content).toContain('test-rule');
  });

  it('output contains # Rules Catalog header', () => {
    runScript(SCRIPT, [
      '--rules-dir', join(tmpDir, 'rules', 'core'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    const content = readFileSync(join(tmpDir, 'docs', 'rules-catalog.md'), 'utf8');
    expect(content).toContain('# Rules Catalog');
  });

  it('output contains table with expected columns', () => {
    runScript(SCRIPT, [
      '--rules-dir', join(tmpDir, 'rules', 'core'),
      '--output-dir', join(tmpDir, 'docs'),
    ]);
    const content = readFileSync(join(tmpDir, 'docs', 'rules-catalog.md'), 'utf8');
    expect(content).toContain('| Rule |');
    expect(content).toContain('Description');
    expect(content).toContain('Area');
    expect(content).toContain('Always Applied');
  });

  it('handles rule with no frontmatter — exits 0 and includes rule in output', () => {
    const base = join(tmpdir(), `rules-catalog-nofm-${Date.now()}`);
    mkdirSync(join(base, 'rules', 'core'), { recursive: true });
    mkdirSync(join(base, 'docs'), { recursive: true });
    writeFileSync(join(base, 'rules', 'core', 'plain-rule.mdc'), RULE_NO_FRONTMATTER);
    const { exitCode } = runScript(SCRIPT, [
      '--rules-dir', join(base, 'rules', 'core'),
      '--output-dir', join(base, 'docs'),
    ]);
    expect(exitCode).toBe(0);
    const content = readFileSync(join(base, 'docs', 'rules-catalog.md'), 'utf8');
    expect(content).toContain('plain-rule');
    rmSync(base, { recursive: true, force: true });
  });

  it('handles empty rules directory — exits 0, catalog present with total 0', () => {
    const base = join(tmpdir(), `rules-catalog-empty-${Date.now()}`);
    mkdirSync(join(base, 'rules', 'core'), { recursive: true });
    mkdirSync(join(base, 'docs'), { recursive: true });
    const { exitCode } = runScript(SCRIPT, [
      '--rules-dir', join(base, 'rules', 'core'),
      '--output-dir', join(base, 'docs'),
    ]);
    expect(exitCode).toBe(0);
    const content = readFileSync(join(base, 'docs', 'rules-catalog.md'), 'utf8');
    expect(content).toContain('# Rules Catalog');
    expect(content).toContain('Total: 0 rules');
    rmSync(base, { recursive: true, force: true });
  });

  it('exits non-zero when rules directory does not exist', () => {
    const { exitCode, stderr } = runScript(SCRIPT, [
      '--rules-dir', '/nonexistent/rules/core',
      '--output-dir', '/tmp/nowhere',
    ]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('ERROR');
  });

  it('dry-run does not write output file', () => {
    const base = join(tmpdir(), `rules-catalog-dryrun-${Date.now()}`);
    mkdirSync(join(base, 'rules', 'core'), { recursive: true });
    mkdirSync(join(base, 'docs'), { recursive: true });
    writeFileSync(join(base, 'rules', 'core', 'some-rule.mdc'), RULE_WITH_FRONTMATTER);
    const { exitCode, stdout } = runScript(SCRIPT, [
      '--rules-dir', join(base, 'rules', 'core'),
      '--output-dir', join(base, 'docs'),
      '--dry-run',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('DRY RUN');
    expect(existsSync(join(base, 'docs', 'rules-catalog.md'))).toBe(false);
    rmSync(base, { recursive: true, force: true });
  });

  it('alwaysApply: true is shown as Yes in output', () => {
    const base = join(tmpdir(), `rules-catalog-always-${Date.now()}`);
    mkdirSync(join(base, 'rules', 'core'), { recursive: true });
    mkdirSync(join(base, 'docs'), { recursive: true });
    writeFileSync(
      join(base, 'rules', 'core', 'always-rule.mdc'),
      `---\ndescription: Always applied rule\nalwaysApply: true\n---\n# Always\n`,
    );
    runScript(SCRIPT, [
      '--rules-dir', join(base, 'rules', 'core'),
      '--output-dir', join(base, 'docs'),
    ]);
    const content = readFileSync(join(base, 'docs', 'rules-catalog.md'), 'utf8');
    expect(content).toContain('Yes');
    rmSync(base, { recursive: true, force: true });
  });
});
