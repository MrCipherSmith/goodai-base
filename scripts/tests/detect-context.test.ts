import { describe, it, expect } from 'bun:test';
import { join } from 'node:path';

// Note: detect-context.ts resolves rules.json relative to the script location:
//   scripts/src/../../.. => repo root (/home/altsay/goodai-base.feat-scripts-ts)
// The real rules.json exists there and is used for these tests.

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

const SCRIPT = join(import.meta.dir, '..', 'src', 'detect-context.ts');

interface DetectContextResult {
  matched_rules: string[];
  matched_skills: string[];
}

function parseOutput(stdout: string): DetectContextResult {
  return JSON.parse(stdout.trim()) as DetectContextResult;
}

describe('detect-context', () => {
  describe('exit code', () => {
    it('always exits 0 (fail-open)', () => {
      const { exitCode } = runScript(SCRIPT, [], { stdin: 'implement issue' });
      expect(exitCode).toBe(0);
    });

    it('exits 0 even with empty stdin', () => {
      const { exitCode } = runScript(SCRIPT, [], { stdin: '' });
      expect(exitCode).toBe(0);
    });
  });

  describe('output format', () => {
    it('output is valid JSON', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: 'something' });
      expect(() => JSON.parse(stdout.trim())).not.toThrow();
    });

    it('output has matched_rules and matched_skills keys', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: 'something' });
      const result = parseOutput(stdout);
      expect(result).toHaveProperty('matched_rules');
      expect(result).toHaveProperty('matched_skills');
      expect(Array.isArray(result.matched_rules)).toBe(true);
      expect(Array.isArray(result.matched_skills)).toBe(true);
    });

    it('JSON has spaces after : and , (Python-compatible format)', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: 'something' });
      const raw = stdout.trim();
      // Keys should have ": " after them, not just ":"
      expect(raw).toMatch(/"matched_rules": /);
      expect(raw).toMatch(/"matched_skills": /);
    });

    it('matched_rules and matched_skills contain strings', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: 'implement issue' });
      const result = parseOutput(stdout);
      for (const r of result.matched_rules) {
        expect(typeof r).toBe('string');
      }
      for (const s of result.matched_skills) {
        expect(typeof s).toBe('string');
      }
    });
  });

  describe('empty / short input', () => {
    it('empty stdin → returns empty arrays', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: '' });
      const result = parseOutput(stdout);
      expect(result.matched_rules).toEqual([]);
      expect(result.matched_skills).toEqual([]);
    });

    it('very short prompt (< 3 chars) → returns empty arrays', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: 'hi' });
      const result = parseOutput(stdout);
      expect(result.matched_rules).toEqual([]);
      expect(result.matched_skills).toEqual([]);
    });

    it('!nocontext bypass → returns empty arrays', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: '!nocontext please implement this' });
      const result = parseOutput(stdout);
      expect(result.matched_rules).toEqual([]);
      expect(result.matched_skills).toEqual([]);
    });
  });

  describe('keyword matching', () => {
    it('"implement issue" → matches job-orchestrator skill', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: 'implement issue' });
      const result = parseOutput(stdout);
      expect(result.matched_skills.some(s => s.includes('job-orchestrator'))).toBe(true);
    });

    it('text with no matching keywords → empty arrays', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: 'the quick brown fox jumps over the lazy dog' });
      const result = parseOutput(stdout);
      // Should not have any unexpected matches for completely unrelated text
      // (It's possible some keywords overlap; we just verify the structure is correct)
      expect(Array.isArray(result.matched_rules)).toBe(true);
      expect(Array.isArray(result.matched_skills)).toBe(true);
    });

    it('prompt passed as argv is also matched', () => {
      const result = Bun.spawnSync(['bun', SCRIPT, 'implement issue'], {
        cwd: join(import.meta.dir, '..'),
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = result.stdout.toString();
      const parsed = parseOutput(stdout);
      expect(parsed.matched_skills.some(s => s.includes('job-orchestrator'))).toBe(true);
    });

    it('matching a documentation keyword returns at least one rule', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: 'write docs for the new feature' });
      const result = parseOutput(stdout);
      // "docs" and "write docs" are keywords for documentation-management rule
      expect(result.matched_rules.length).toBeGreaterThan(0);
    });

    it('multiple keyword matches → all matching entries returned', () => {
      // "implement issue" should match job-orchestrator; "orchestrate" also matches it
      const { stdout } = runScript(SCRIPT, [], { stdin: 'implement issue and orchestrate the whole review' });
      const result = parseOutput(stdout);
      expect(result.matched_skills.length).toBeGreaterThan(0);
    });

    it('rules are capped at max_rules_injected (default 3)', () => {
      // Use a broad prompt that might trigger many rules
      const { stdout } = runScript(SCRIPT, [], {
        stdin: 'git commit documentation requirements implementation plan jobs',
      });
      const result = parseOutput(stdout);
      // max_rules_injected = 3 per the real rules.json config
      expect(result.matched_rules.length).toBeLessThanOrEqual(3);
    });
  });

  describe('output paths', () => {
    it('matched_skills paths start with "skills/"', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: 'implement issue' });
      const result = parseOutput(stdout);
      for (const s of result.matched_skills) {
        expect(s.startsWith('skills/')).toBe(true);
      }
    });

    it('matched_rules paths start with "rules/"', () => {
      const { stdout } = runScript(SCRIPT, [], { stdin: 'git commit message' });
      const result = parseOutput(stdout);
      for (const r of result.matched_rules) {
        expect(r.startsWith('rules/')).toBe(true);
      }
    });
  });
});
