import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
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

const SCRIPT = join(import.meta.dir, '..', 'src', 'validate-skills-before-sync.ts');

const VALID_SCHEMA = JSON.stringify({
  type: 'object',
  additionalProperties: false,
  required: ['status', 'decision', 'timestamp_utc'],
  properties: {
    workflow: {
      enum: ['skill-create', 'skill-update', 'skill-delete'],
    },
    status: { type: 'string' },
    decision: { type: 'string' },
    timestamp_utc: { type: 'string' },
  },
});

const VALID_FRONTMATTER = `---
name: my-skill
description: "Use when testing"
---
Body here.
`;

let rootTmpDir: string;
let schemaFile: string;

function createSkillsDir(name: string): string {
  const dir = join(rootTmpDir, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createSkill(skillsDir: string, skillName: string, files: Record<string, string>): void {
  const skillDir = join(skillsDir, skillName);
  mkdirSync(skillDir, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    writeFileSync(join(skillDir, filename), content);
  }
}

beforeAll(() => {
  rootTmpDir = join(tmpdir(), `validate-skills-test-${Date.now()}`);
  mkdirSync(rootTmpDir, { recursive: true });

  schemaFile = join(rootTmpDir, 'skill-workflow-result.schema.json');
  writeFileSync(schemaFile, VALID_SCHEMA);
});

afterAll(() => {
  rmSync(rootTmpDir, { recursive: true, force: true });
});

describe('validate-skills-before-sync', () => {
  describe('valid skill directory', () => {
    it('valid skills directory with all required platform files → exits 0', () => {
      const skillsDir = createSkillsDir('valid-skills');
      createSkill(skillsDir, 'my-skill', {
        'SKILL.md': VALID_FRONTMATTER,
        'SKILL.cursor.md': VALID_FRONTMATTER,
        'SKILL.codex.md': VALID_FRONTMATTER,
      });

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Validation passed:');
      expect(stdout).toContain('skill profile file(s) checked');
    });

    it('valid skills directory with all platform files reports correct count', () => {
      const skillsDir = createSkillsDir('valid-skills-count');
      createSkill(skillsDir, 'my-skill', {
        'SKILL.md': VALID_FRONTMATTER,
        'SKILL.cursor.md': VALID_FRONTMATTER,
        'SKILL.codex.md': VALID_FRONTMATTER,
        'SKILL.zed.md': VALID_FRONTMATTER,
        'SKILL.opencode.md': VALID_FRONTMATTER,
      });

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(0);
      // 4 platform files (cursor, codex, zed, opencode)
      expect(stdout).toContain('4 skill profile file(s) checked');
    });
  });

  describe('missing required platform files', () => {
    it('missing SKILL.cursor.md → exits 1 with FAIL message', () => {
      const skillsDir = createSkillsDir('missing-cursor');
      createSkill(skillsDir, 'my-skill', {
        'SKILL.md': VALID_FRONTMATTER,
        'SKILL.codex.md': VALID_FRONTMATTER,
        // No SKILL.cursor.md
      });

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain('FAIL: my-skill - required profile missing: SKILL.cursor.md');
    });

    it('missing SKILL.codex.md → exits 1 with FAIL message', () => {
      const skillsDir = createSkillsDir('missing-codex');
      createSkill(skillsDir, 'my-skill', {
        'SKILL.md': VALID_FRONTMATTER,
        'SKILL.cursor.md': VALID_FRONTMATTER,
        // No SKILL.codex.md
      });

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain('FAIL: my-skill - required profile missing: SKILL.codex.md');
    });
  });

  describe('frontmatter validation', () => {
    it('missing name in frontmatter → exits 1', () => {
      const skillsDir = createSkillsDir('missing-name');
      const content = `---
description: "Use when testing"
---
Body here.
`;
      createSkill(skillsDir, 'my-skill', {
        'SKILL.md': content,
        'SKILL.cursor.md': content,
        'SKILL.codex.md': content,
      });

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain("missing 'name' in frontmatter");
    });

    it('missing description in frontmatter → exits 1', () => {
      const skillsDir = createSkillsDir('missing-desc');
      const content = `---
name: my-skill
---
Body here.
`;
      createSkill(skillsDir, 'my-skill', {
        'SKILL.md': content,
        'SKILL.cursor.md': content,
        'SKILL.codex.md': content,
      });

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain("missing 'description' in frontmatter");
    });

    it('invalid name with uppercase → exits 1', () => {
      const skillsDir = createSkillsDir('uppercase-name');
      const content = `---
name: My-Skill
description: "Use when testing"
---
Body here.
`;
      createSkill(skillsDir, 'my-skill', {
        'SKILL.md': content,
        'SKILL.cursor.md': content,
        'SKILL.codex.md': content,
      });

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain('invalid name');
      expect(stdout).toContain('My-Skill');
    });

    it('name longer than 64 characters → exits 1', () => {
      const longName = 'a'.repeat(65);
      const skillsDir = createSkillsDir('long-name');
      const content = `---
name: ${longName}
description: "Use when testing"
---
Body here.
`;
      createSkill(skillsDir, 'my-skill', {
        'SKILL.md': content,
        'SKILL.cursor.md': content,
        'SKILL.codex.md': content,
      });

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain('name too long');
    });

    it('missing opening --- delimiter → exits 1', () => {
      const skillsDir = createSkillsDir('no-open-delim');
      const content = `name: my-skill
description: "Use when testing"
---
Body here.
`;
      createSkill(skillsDir, 'my-skill', {
        'SKILL.md': content,
        'SKILL.cursor.md': content,
        'SKILL.codex.md': content,
      });

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain('missing opening YAML frontmatter delimiter');
    });

    it('missing closing --- delimiter → exits 1', () => {
      const skillsDir = createSkillsDir('no-close-delim');
      const content = `---
name: my-skill
description: "Use when testing"
Body here.
`;
      createSkill(skillsDir, 'my-skill', {
        'SKILL.md': content,
        'SKILL.cursor.md': content,
        'SKILL.codex.md': content,
      });

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain('missing closing YAML frontmatter delimiter');
    });
  });

  describe('shared directory is skipped', () => {
    it('shared directory is not treated as a skill', () => {
      const skillsDir = createSkillsDir('with-shared');
      // Create a shared directory without the required files — should be skipped
      const sharedDir = join(skillsDir, 'shared');
      mkdirSync(sharedDir, { recursive: true });
      writeFileSync(join(sharedDir, 'some-util.ts'), 'export function util() {}');

      // Also add a valid skill
      createSkill(skillsDir, 'real-skill', {
        'SKILL.md': VALID_FRONTMATTER,
        'SKILL.cursor.md': VALID_FRONTMATTER,
        'SKILL.codex.md': VALID_FRONTMATTER,
      });

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(0);
      // Only the real skill's platform files counted
      expect(stdout).toContain('Validation passed:');
      expect(stdout).not.toContain('FAIL: shared');
    });
  });

  describe('empty skills directory', () => {
    it('empty skills directory → exits 0 with 0 files checked', () => {
      const skillsDir = createSkillsDir('empty-skills');

      const { stdout, exitCode } = runScript(SCRIPT, [skillsDir, schemaFile]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('0 skill profile file(s) checked');
    });
  });

  describe('missing arguments', () => {
    it('missing skills directory → exits 1 with error', () => {
      const nonExistentDir = join(rootTmpDir, 'does-not-exist');

      const { stderr, exitCode } = runScript(SCRIPT, [nonExistentDir, schemaFile]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Error: skills directory not found');
    });

    it('missing schema file → exits 1 with error', () => {
      const skillsDir = createSkillsDir('valid-for-schema-test');
      const nonExistentSchema = join(rootTmpDir, 'nonexistent-schema.json');

      const { stderr, exitCode } = runScript(SCRIPT, [skillsDir, nonExistentSchema]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Error: schema file not found');
    });

    it('invalid schema (missing required fields) → exits 1 with schema sanity check failed', () => {
      const skillsDir = createSkillsDir('skills-for-bad-schema');
      const badSchemaFile = join(rootTmpDir, 'bad-schema.json');

      // Missing "decision" and "timestamp_utc" from required, no workflow enum
      writeFileSync(badSchemaFile, JSON.stringify({
        type: 'object',
        additionalProperties: false,
        required: ['status'],
        properties: {
          status: { type: 'string' },
        },
      }));

      const { stderr, exitCode } = runScript(SCRIPT, [skillsDir, badSchemaFile]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('schema sanity check failed');
    });

    it('malformed schema JSON → exits 1 with schema sanity check failed', () => {
      const skillsDir = createSkillsDir('skills-for-malformed-schema');
      const malformedSchemaFile = join(rootTmpDir, 'malformed-schema.json');

      writeFileSync(malformedSchemaFile, '{ not valid json }');

      const { stderr, exitCode } = runScript(SCRIPT, [skillsDir, malformedSchemaFile]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('schema sanity check failed');
    });
  });
});
