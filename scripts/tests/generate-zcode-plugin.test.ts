import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'src', 'generate-zcode-plugin.ts');
const PLUGIN_NAME = 'goodai-zcode';

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

describe('generate-zcode-plugin.ts', () => {
  it('keeps the generated ZCode plugin up to date', () => {
    const result = runScript(['--check']);
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('ZCode plugin output is up to date');
  }, 60_000);

  it('creates a ZCode marketplace manifest with the goodai-zcode plugin', () => {
    const marketplace = readJson(join(ROOT, '.agents', 'zcode-plugins', 'marketplace.json'));
    expect(marketplace.name).toBe('goodai-base');
    expect(marketplace.version).toBe(1);
    expect(marketplace.plugins).toHaveLength(1);

    const plugin = marketplace.plugins[0];
    expect(plugin.name).toBe(PLUGIN_NAME);
    expect(plugin.source).toBe('filesystem');
    expect(typeof plugin.version).toBe('string');
    expect(plugin.cachePath).toBe(`./plugins/${PLUGIN_NAME}`);
  });

  it('creates a plugin.json in the ZCode plugin format', () => {
    const pluginRoot = join(ROOT, 'plugins', PLUGIN_NAME);
    const manifest = readJson(join(pluginRoot, '.zcode-plugin', 'plugin.json'));

    expect(manifest.name).toBe(PLUGIN_NAME);
    // ZCode uses a bare directory name, NOT a "./path/" like Codex.
    expect(manifest.skills).toBe('skills');
    expect(manifest.license).toBe('MIT');
    expect(manifest.homepage).toBe('https://github.com/MrCipherSmith/goodai-base');
    expect(manifest.author.name).toBe('MrCipherSmith');
  });

  it('bundles every skill and the shared references', () => {
    const pluginRoot = join(ROOT, 'plugins', PLUGIN_NAME);

    // All monolith skills must be present.
    expect(existsSync(join(pluginRoot, 'skills', 'job-orchestrator', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginRoot, 'skills', 'review-orchestrator', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginRoot, 'skills', 'commit', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(pluginRoot, 'skills', 'prd-creator', 'SKILL.md'))).toBe(true);

    // Shared snippets + AGENTS.md router + rules/docs.
    expect(existsSync(join(pluginRoot, 'skills', 'shared'))).toBe(true);
    expect(existsSync(join(pluginRoot, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(pluginRoot, 'rules', 'core'))).toBe(true);
    expect(existsSync(join(pluginRoot, 'docs'))).toBe(true);
  });
});
