import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'src', 'generate-codex-plugins.ts');

function runScript(args: string[] = []): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync([process.execPath, SCRIPT, ...args], {
    cwd: join(ROOT, 'scripts'),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode ?? 1,
  };
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('generate-codex-plugins.ts', () => {
  it('keeps generated Codex plugins up to date', () => {
    const result = runScript(['--check']);
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Codex plugin output is up to date');
  }, 60_000);

  it('creates a Codex marketplace with expected bundle entries', () => {
    const marketplace = readJson(join(ROOT, '.agents', 'plugins', 'marketplace.json'));
    const names = marketplace.plugins.map((plugin: any) => plugin.name);

    expect(names).toEqual([
      'goodai-base',
      'goodai-core',
      'goodai-review',
      'goodai-orchestration',
      'goodai-project-docs',
    ]);

    for (const plugin of marketplace.plugins) {
      expect(plugin.source.source).toBe('local');
      expect(plugin.source.path).toBe(`./plugins/${plugin.name}`);
      expect(plugin.policy.installation).toBe('AVAILABLE');
      expect(plugin.policy.authentication).toBe('ON_INSTALL');
      expect(plugin.category).toBeTruthy();
    }
  });

  it('creates plugin manifests and user-facing skill content', () => {
    const expectedSkills: Record<string, string[]> = {
      'goodai-base': ['job-orchestrator', 'review-orchestrator', 'prd-creator'],
      'goodai-core': ['commit', 'pr', 'deploy'],
      'goodai-review': ['review-orchestrator', 'review-logic', 'review-security-code'],
      'goodai-orchestration': ['job-orchestrator', 'task-implementer', 'code-verifier'],
      'goodai-project-docs': ['gproject-orchestrator', 'autodoc-orchestrator', 'prd-creator'],
    };

    for (const [pluginName, skills] of Object.entries(expectedSkills)) {
      const pluginRoot = join(ROOT, 'plugins', pluginName);
      const manifest = readJson(join(pluginRoot, '.codex-plugin', 'plugin.json'));

      expect(manifest.name).toBe(pluginName);
      expect(manifest.skills).toBe('./skills/');
      expect(existsSync(join(pluginRoot, 'AGENTS.md'))).toBe(true);
      expect(existsSync(join(pluginRoot, 'rules', 'core'))).toBe(true);
      expect(existsSync(join(pluginRoot, 'skills', 'shared'))).toBe(true);

      for (const skill of skills) {
        expect(existsSync(join(pluginRoot, 'skills', skill, 'SKILL.md'))).toBe(true);
      }
    }
  });
});
