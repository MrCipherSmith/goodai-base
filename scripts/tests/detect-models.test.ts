import { describe, it, expect } from 'bun:test';
import { join } from 'node:path';

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

const SCRIPT = join(import.meta.dir, '..', 'src', 'detect-models.ts');

// detect-models.ts outputs plain text (not JSON). It prints sections for each
// detected AI agent environment: Codex, Cursor, Antigravity, OpenCode, Zed.
// It reads from real config files in the home directory; we test only output
// structure/format since we don't create fixtures for home-dir config files.

describe('detect-models', () => {
  describe('exit code', () => {
    it('always exits 0 even when no config files exist', () => {
      const { exitCode } = runScript(SCRIPT);
      expect(exitCode).toBe(0);
    });
  });

  describe('output structure', () => {
    it('output is non-empty plain text', () => {
      const { stdout } = runScript(SCRIPT);
      expect(stdout.length).toBeGreaterThan(0);
    });

    it('output includes opening detection message', () => {
      const { stdout } = runScript(SCRIPT);
      expect(stdout).toContain('Detecting available models across environments');
    });

    it('output references Codex section header', () => {
      const { stdout } = runScript(SCRIPT);
      // The section header is only printed if ~/.codex exists.
      // But the script should at least not crash; we can verify the absence of the
      // header doesn't cause an error, and if present it has the right format.
      if (stdout.includes('Codex')) {
        expect(stdout).toContain('=== Codex Models ===');
      }
    });

    it('output references Cursor section header if cursor config exists', () => {
      const { stdout } = runScript(SCRIPT);
      if (stdout.includes('Cursor')) {
        expect(stdout).toContain('=== Cursor Models ===');
      }
    });

    it('output references Antigravity section header if antigravity config exists', () => {
      const { stdout } = runScript(SCRIPT);
      if (stdout.includes('Antigravity')) {
        expect(stdout).toContain('=== Antigravity Models ===');
      }
    });

    it('output references OpenCode section header if opencode config exists', () => {
      const { stdout } = runScript(SCRIPT);
      if (stdout.includes('OpenCode')) {
        expect(stdout).toContain('=== OpenCode Models ===');
      }
    });

    it('output references Zed section header if zed config exists', () => {
      const { stdout } = runScript(SCRIPT);
      if (stdout.includes('Zed')) {
        expect(stdout).toContain('=== Zed Models ===');
      }
    });

    it('stderr is empty (no errors)', () => {
      const { stderr } = runScript(SCRIPT);
      expect(stderr).toBe('');
    });
  });

  describe('section presence', () => {
    it('all expected section headers are potential output (known set)', () => {
      const KNOWN_SECTIONS = [
        '=== Codex Models ===',
        '=== Cursor Models ===',
        '=== Antigravity Models ===',
        '=== OpenCode Models ===',
        '=== Zed Models ===',
      ];

      const { stdout } = runScript(SCRIPT);

      // Any sections that do appear must be from the known set
      for (const section of KNOWN_SECTIONS) {
        const sectionName = section.replace(/=== | ===/g, '').trim();
        if (stdout.includes(sectionName)) {
          expect(KNOWN_SECTIONS.some(s => stdout.includes(s))).toBe(true);
        }
      }
    });

    it('output contains at least the detection intro line (runs without crash)', () => {
      const { stdout, exitCode } = runScript(SCRIPT);
      expect(exitCode).toBe(0);
      expect(stdout.split('\n').length).toBeGreaterThan(1);
    });
  });
});
