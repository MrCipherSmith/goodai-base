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

const SCRIPT = join(import.meta.dir, '..', 'src', 'generate-rules-json.ts');

// The agents-md parser uses these regex patterns:
//   Rules: `core/<file>.mdc`: <description>  (colon or em-dash separator)
//   Skills: **`skills/<name>`** · <trigger>\n  Use when: <description>
//            OR **`skills/<name>`**\n  Purpose: <description>
const AGENTS_MD = `# AGENTS.md

## 📖 Core Rule Catalog

- \`core/git-rules.mdc\`: Git workflow and commit standards
- \`core/review-profile.mdc\`: Code review quality standards

## 🎨 Skills Catalog

**\`skills/commit\`** · commit
  Use when: creating commits and writing commit messages

**\`skills/code-review\`**
  Purpose: Use when reviewing pull requests
`;

describe('generate-rules-json.ts', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(tmpdir(), `rules-json-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates rules.json with entries when file does not exist', () => {
    const base = join(tmpdir(), `rules-json-create-${Date.now()}`);
    mkdirSync(base, { recursive: true });
    const agentsMd = join(base, 'AGENTS.md');
    const output = join(base, 'rules.json');
    writeFileSync(agentsMd, AGENTS_MD);

    const { exitCode } = runScript(SCRIPT, [
      '--agents-md', agentsMd,
      '--output', output,
    ]);
    expect(exitCode).toBe(0);
    expect(existsSync(output)).toBe(true);

    const json = JSON.parse(readFileSync(output, 'utf8'));
    expect(json.entries).toBeArray();
    expect(json.entries.length).toBeGreaterThan(0);
    rmSync(base, { recursive: true, force: true });
  });

  it('rules.json has entries for both rules and skills', () => {
    const base = join(tmpdir(), `rules-json-both-${Date.now()}`);
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, 'AGENTS.md'), AGENTS_MD);
    const output = join(base, 'rules.json');
    runScript(SCRIPT, ['--agents-md', join(base, 'AGENTS.md'), '--output', output]);

    const json = JSON.parse(readFileSync(output, 'utf8'));
    const types = json.entries.map((e: { type: string }) => e.type);
    expect(types).toContain('rule');
    expect(types).toContain('skill');
    rmSync(base, { recursive: true, force: true });
  });

  it('each entry has required fields: id, type, path, description, triggers.keywords', () => {
    const base = join(tmpdir(), `rules-json-fields-${Date.now()}`);
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, 'AGENTS.md'), AGENTS_MD);
    const output = join(base, 'rules.json');
    runScript(SCRIPT, ['--agents-md', join(base, 'AGENTS.md'), '--output', output]);

    const json = JSON.parse(readFileSync(output, 'utf8'));
    for (const entry of json.entries) {
      expect(typeof entry.id).toBe('string');
      expect(entry.type === 'rule' || entry.type === 'skill').toBe(true);
      expect(typeof entry.path).toBe('string');
      expect(typeof entry.description).toBe('string');
      expect(entry.triggers).toBeDefined();
      expect(Array.isArray(entry.triggers.keywords)).toBe(true);
    }
    rmSync(base, { recursive: true, force: true });
  });

  it('type is "rule" for rules entries and "skill" for skills entries', () => {
    const base = join(tmpdir(), `rules-json-types-${Date.now()}`);
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, 'AGENTS.md'), AGENTS_MD);
    const output = join(base, 'rules.json');
    runScript(SCRIPT, ['--agents-md', join(base, 'AGENTS.md'), '--output', output]);

    const json = JSON.parse(readFileSync(output, 'utf8'));
    const ruleEntries = json.entries.filter((e: { type: string }) => e.type === 'rule');
    const skillEntries = json.entries.filter((e: { type: string }) => e.type === 'skill');

    expect(ruleEntries.length).toBeGreaterThan(0);
    expect(skillEntries.length).toBeGreaterThan(0);

    for (const rule of ruleEntries) {
      expect(rule.path).toContain('rules/core/');
    }
    for (const skill of skillEntries) {
      expect(skill.path).toContain('skills/');
    }
    rmSync(base, { recursive: true, force: true });
  });

  it('keywords are derived from description (non-trivial words)', () => {
    const base = join(tmpdir(), `rules-json-keywords-${Date.now()}`);
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, 'AGENTS.md'), AGENTS_MD);
    const output = join(base, 'rules.json');
    runScript(SCRIPT, ['--agents-md', join(base, 'AGENTS.md'), '--output', output]);

    const json = JSON.parse(readFileSync(output, 'utf8'));
    const gitRulesEntry = json.entries.find((e: { id: string }) => e.id === 'git-rules');
    expect(gitRulesEntry).toBeDefined();
    // "Git workflow and commit standards" → keywords should include meaningful words
    // stop words like "and" should NOT appear
    expect(gitRulesEntry.triggers.keywords).not.toContain('and');
    expect(gitRulesEntry.triggers.keywords.length).toBeGreaterThan(0);
    rmSync(base, { recursive: true, force: true });
  });

  it('preserves existing custom keywords when re-running', () => {
    const base = join(tmpdir(), `rules-json-preserve-${Date.now()}`);
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, 'AGENTS.md'), AGENTS_MD);
    const output = join(base, 'rules.json');

    // First run — generate initial rules.json
    runScript(SCRIPT, ['--agents-md', join(base, 'AGENTS.md'), '--output', output]);

    // Inject custom keywords into git-rules entry
    const json = JSON.parse(readFileSync(output, 'utf8'));
    const gitRulesEntry = json.entries.find((e: { id: string }) => e.id === 'git-rules');
    expect(gitRulesEntry).toBeDefined();
    gitRulesEntry.triggers.keywords = ['custom-keyword-xyz', 'another-custom-kw'];
    writeFileSync(output, JSON.stringify(json, null, 2) + '\n');

    // Second run — re-generate
    runScript(SCRIPT, ['--agents-md', join(base, 'AGENTS.md'), '--output', output]);

    // Custom keywords should be preserved
    const json2 = JSON.parse(readFileSync(output, 'utf8'));
    const entry2 = json2.entries.find((e: { id: string }) => e.id === 'git-rules');
    expect(entry2).toBeDefined();
    expect(entry2.triggers.keywords).toContain('custom-keyword-xyz');
    expect(entry2.triggers.keywords).toContain('another-custom-kw');
    rmSync(base, { recursive: true, force: true });
  });

  it('exits 0 on success', () => {
    const base = join(tmpdir(), `rules-json-exit-${Date.now()}`);
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, 'AGENTS.md'), AGENTS_MD);
    const { exitCode } = runScript(SCRIPT, [
      '--agents-md', join(base, 'AGENTS.md'),
      '--output', join(base, 'rules.json'),
    ]);
    expect(exitCode).toBe(0);
    rmSync(base, { recursive: true, force: true });
  });

  it('exits non-zero when AGENTS.md not found', () => {
    const { exitCode, stderr } = runScript(SCRIPT, [
      '--agents-md', '/nonexistent/AGENTS.md',
      '--output', '/tmp/rules.json',
    ]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('ERROR');
  });

  it('exits non-zero when AGENTS.md has no parseable entries', () => {
    const base = join(tmpdir(), `rules-json-empty-${Date.now()}`);
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, 'AGENTS.md'), '# Empty AGENTS.md\n\nNo rule or skill sections here.\n');
    const { exitCode, stderr } = runScript(SCRIPT, [
      '--agents-md', join(base, 'AGENTS.md'),
      '--output', join(base, 'rules.json'),
    ]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('ERROR');
    rmSync(base, { recursive: true, force: true });
  });

  it('--dry-run prints what would change but does not write file', () => {
    const base = join(tmpdir(), `rules-json-dryrun-${Date.now()}`);
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, 'AGENTS.md'), AGENTS_MD);
    const output = join(base, 'rules.json');

    const { exitCode, stdout } = runScript(SCRIPT, [
      '--agents-md', join(base, 'AGENTS.md'),
      '--output', output,
      '--dry-run',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('DRY RUN');
    expect(existsSync(output)).toBe(false);
    rmSync(base, { recursive: true, force: true });
  });
});
