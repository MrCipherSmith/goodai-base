import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function runScript(scriptPath: string, args: string[] = [], opts: { stdin?: string } = {}): {
  stdout: string; stderr: string; exitCode: number;
} {
  const result = Bun.spawnSync(['bun', scriptPath, ...args], {
    cwd: join(import.meta.dir, '..'),
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: opts.stdin ? Buffer.from(opts.stdin) : undefined,
  });
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode ?? 1,
  };
}

const SCRIPT = join(import.meta.dir, '..', 'src', 'validate-rules-json.ts');

// Temp directory for fixtures
let tmpDir: string;

// Fixture content helpers
function makeRulesJson(entries: object[]): string {
  return JSON.stringify({ version: '1.0', entries });
}

function makeAgentsMd(rules: Array<{ file: string; desc: string }>, skills: Array<{ name: string; desc: string }>): string {
  const rulesSection = rules.length > 0
    ? `## 📖 Core Rule Catalog\n\n${rules.map(r => `- \`core/${r.file}\`: ${r.desc}`).join('\n')}\n`
    : `## 📖 Core Rule Catalog\n\n(none)\n`;

  const skillsSection = skills.length > 0
    ? `## 🎨 Skills Catalog\n\n${skills.map(s => `**\`skills/${s.name}\`**\n\nUse when: ${s.desc}`).join('\n\n')}\n`
    : `## 🎨 Skills Catalog\n\n(none)\n`;

  return `# AGENTS.md\n\n${rulesSection}\n${skillsSection}`;
}

beforeAll(() => {
  tmpDir = join(tmpdir(), `validate-rules-json-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Create a real rules/core directory with a real file so path checks pass
  mkdirSync(join(tmpDir, 'rules', 'core'), { recursive: true });
  writeFileSync(join(tmpDir, 'rules', 'core', 'git-rules.mdc'), '# Git Rules');

  // Create a real skills directory with a SKILL.md
  mkdirSync(join(tmpDir, 'skills', 'commit-skill'), { recursive: true });
  writeFileSync(join(tmpDir, 'skills', 'commit-skill', 'SKILL.md'), '# Commit Skill');
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('validate-rules-json', () => {
  describe('valid input', () => {
    it('valid rules.json + matching AGENTS.md → exits 0 and prints PASSED', () => {
      const rulesJsonPath = join(tmpDir, 'rules-valid.json');
      const agentsMdPath = join(tmpDir, 'AGENTS-valid.md');

      writeFileSync(rulesJsonPath, makeRulesJson([
        {
          id: 'git-rules',
          type: 'rule',
          path: join(tmpDir, 'rules', 'core', 'git-rules.mdc'),
          description: 'Git rules',
          triggers: { keywords: ['git', 'commit'], intents: [] },
        },
        {
          id: 'commit-skill',
          type: 'skill',
          path: join(tmpDir, 'skills', 'commit-skill', 'SKILL.md'),
          description: 'Commit skill',
          triggers: { keywords: ['commit'], intents: [] },
        },
      ]));

      writeFileSync(agentsMdPath, makeAgentsMd(
        [{ file: 'git-rules.mdc', desc: 'Git rules' }],
        [{ name: 'commit-skill', desc: 'commit something' }],
      ));

      const { stdout, exitCode } = runScript(SCRIPT, [
        '--rules-json', rulesJsonPath,
        '--agents-md', agentsMdPath,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('PASSED');
    });
  });

  describe('AGENTS.md entry missing from rules.json', () => {
    it('AGENTS.md rule entry missing from rules.json → exits 1 with ERROR', () => {
      const rulesJsonPath = join(tmpDir, 'rules-missing-rule.json');
      const agentsMdPath = join(tmpDir, 'AGENTS-extra-rule.md');

      // rules.json has only the skill, not the rule
      writeFileSync(rulesJsonPath, makeRulesJson([
        {
          id: 'commit-skill',
          type: 'skill',
          path: join(tmpDir, 'skills', 'commit-skill', 'SKILL.md'),
          description: 'Commit skill',
          triggers: { keywords: ['commit'], intents: [] },
        },
      ]));

      // AGENTS.md references git-rules which is absent from rules.json
      writeFileSync(agentsMdPath, makeAgentsMd(
        [{ file: 'git-rules.mdc', desc: 'Git rules' }],
        [{ name: 'commit-skill', desc: 'commit something' }],
      ));

      const { stdout, exitCode } = runScript(SCRIPT, [
        '--rules-json', rulesJsonPath,
        '--agents-md', agentsMdPath,
      ]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain('ERROR');
      expect(stdout).toContain('git-rules');
    });
  });

  describe('rules.json entry missing from AGENTS.md', () => {
    it('rules.json orphaned entry not in AGENTS.md → exits 0 with warning', () => {
      const rulesJsonPath = join(tmpDir, 'rules-orphan.json');
      const agentsMdPath = join(tmpDir, 'AGENTS-orphan.md');

      // rules.json has git-rules but AGENTS.md doesn't list it
      writeFileSync(rulesJsonPath, makeRulesJson([
        {
          id: 'git-rules',
          type: 'rule',
          path: join(tmpDir, 'rules', 'core', 'git-rules.mdc'),
          description: 'Git rules',
          triggers: { keywords: ['git'], intents: [] },
        },
      ]));

      // AGENTS.md has no rules section entries
      writeFileSync(agentsMdPath, makeAgentsMd([], []));

      const { stdout, exitCode } = runScript(SCRIPT, [
        '--rules-json', rulesJsonPath,
        '--agents-md', agentsMdPath,
      ]);

      // Orphaned entries are warnings only, so exits 0
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/WARN/);
      expect(stdout).toContain('git-rules');
    });
  });

  describe('malformed JSON', () => {
    it('malformed rules.json → exits non-zero with error message', () => {
      const rulesJsonPath = join(tmpDir, 'rules-malformed.json');
      const agentsMdPath = join(tmpDir, 'AGENTS-malformed.md');

      writeFileSync(rulesJsonPath, '{ this is not json }');
      writeFileSync(agentsMdPath, makeAgentsMd([], []));

      const { stdout, exitCode } = runScript(SCRIPT, [
        '--rules-json', rulesJsonPath,
        '--agents-md', agentsMdPath,
      ]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain('ERROR');
    });
  });

  describe('missing files', () => {
    it('missing rules.json file → exits non-zero', () => {
      const rulesJsonPath = join(tmpDir, 'nonexistent-rules.json');
      const agentsMdPath = join(tmpDir, 'AGENTS-missing-rules.md');
      writeFileSync(agentsMdPath, makeAgentsMd([], []));

      const { stdout, exitCode } = runScript(SCRIPT, [
        '--rules-json', rulesJsonPath,
        '--agents-md', agentsMdPath,
      ]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain('ERROR');
    });

    it('missing AGENTS.md file → exits non-zero', () => {
      const rulesJsonPath = join(tmpDir, 'rules-no-agents.json');
      const agentsMdPath = join(tmpDir, 'nonexistent-AGENTS.md');

      writeFileSync(rulesJsonPath, makeRulesJson([]));

      const { stdout, exitCode } = runScript(SCRIPT, [
        '--rules-json', rulesJsonPath,
        '--agents-md', agentsMdPath,
      ]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain('ERROR');
    });
  });

  describe('entry with wrong type field', () => {
    it('entry with unknown type is counted but does not block PASSED (orphan warning)', () => {
      const rulesJsonPath = join(tmpDir, 'rules-wrong-type.json');
      const agentsMdPath = join(tmpDir, 'AGENTS-wrong-type.md');

      writeFileSync(rulesJsonPath, makeRulesJson([
        {
          id: 'weird-entry',
          type: 'unknown-type', // not "rule" or "skill"
          path: join(tmpDir, 'rules', 'core', 'git-rules.mdc'),
          description: 'weird',
          triggers: { keywords: [], intents: [] },
        },
      ]));

      writeFileSync(agentsMdPath, makeAgentsMd([], []));

      const { stdout, exitCode } = runScript(SCRIPT, [
        '--rules-json', rulesJsonPath,
        '--agents-md', agentsMdPath,
      ]);

      // Entry exists on disk but isn't in AGENTS.md → orphan warning
      // No errors, so exits 0 with warnings
      expect(exitCode).toBe(0);
      // Should have 0 rules, 0 skills counts (unknown type not counted in ruleCount/skillCount)
      expect(stdout).toContain('Entries checked: 1');
    });
  });

  describe('path validation', () => {
    it('entry path not found on disk → exits 1 with ERROR', () => {
      const rulesJsonPath = join(tmpDir, 'rules-bad-path.json');
      const agentsMdPath = join(tmpDir, 'AGENTS-bad-path.md');

      writeFileSync(rulesJsonPath, makeRulesJson([
        {
          id: 'git-rules',
          type: 'rule',
          path: join(tmpDir, 'rules', 'core', 'nonexistent-file.mdc'),
          description: 'Git rules',
          triggers: { keywords: ['git'], intents: [] },
        },
      ]));

      writeFileSync(agentsMdPath, makeAgentsMd(
        [{ file: 'git-rules.mdc', desc: 'Git rules' }],
        [],
      ));

      const { stdout, exitCode } = runScript(SCRIPT, [
        '--rules-json', rulesJsonPath,
        '--agents-md', agentsMdPath,
      ]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain('ERROR');
      expect(stdout).toContain('nonexistent-file.mdc');
    });
  });
});
