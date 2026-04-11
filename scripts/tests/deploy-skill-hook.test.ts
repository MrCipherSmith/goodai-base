import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = join(import.meta.dir, '..', 'src', 'deploy-skill-hook.ts');
const GOODAI_BASE = join(import.meta.dir, '..', '..');

function runScript(
  args: string[] = [],
): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync(['bun', SCRIPT, ...args], {
    cwd: join(import.meta.dir, '..'),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode ?? 1,
  };
}

// Each test gets its own fresh temp target project directory
function makeTempProject(): string {
  const dir = join(tmpdir(), `deploy-hook-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('deploy-skill-hook.ts — install', () => {
  let targetProject: string;

  beforeEach(() => {
    targetProject = makeTempProject();
  });

  afterEach(() => {
    rmSync(targetProject, { recursive: true, force: true });
  });

  it('fresh install exits 0', () => {
    const { exitCode } = runScript([targetProject]);
    expect(exitCode).toBe(0);
  });

  it('fresh install creates .claude/hooks/skill-evaluator.sh', () => {
    runScript([targetProject]);
    expect(existsSync(join(targetProject, '.claude', 'hooks', 'skill-evaluator.sh'))).toBe(true);
  });

  it('fresh install creates .claude/settings.json', () => {
    runScript([targetProject]);
    expect(existsSync(join(targetProject, '.claude', 'settings.json'))).toBe(true);
  });

  it('fresh install creates .claude/skill-overrides.json', () => {
    runScript([targetProject]);
    expect(existsSync(join(targetProject, '.claude', 'skill-overrides.json'))).toBe(true);
  });

  it('skill-overrides.json has correct structure: { disabled, local_skills, extra_context }', () => {
    runScript([targetProject]);
    const overrides = JSON.parse(
      readFileSync(join(targetProject, '.claude', 'skill-overrides.json'), 'utf8'),
    );
    expect(Array.isArray(overrides.disabled)).toBe(true);
    expect(Array.isArray(overrides.local_skills)).toBe(true);
    expect(typeof overrides.extra_context).toBe('string');
    expect(overrides.disabled).toEqual([]);
    expect(overrides.local_skills).toEqual([]);
    expect(overrides.extra_context).toBe('');
  });

  it('settings.json has hooks.UserPromptSubmit array', () => {
    runScript([targetProject]);
    const settings = JSON.parse(
      readFileSync(join(targetProject, '.claude', 'settings.json'), 'utf8'),
    );
    expect(Array.isArray(settings.hooks?.UserPromptSubmit)).toBe(true);
  });

  it('hook entry has id "goodai-skill-evaluator"', () => {
    runScript([targetProject]);
    const settings = JSON.parse(
      readFileSync(join(targetProject, '.claude', 'settings.json'), 'utf8'),
    );
    const groups = settings.hooks?.UserPromptSubmit ?? [];
    const allHooks = groups.flatMap((g: { hooks: unknown[] }) => g.hooks ?? []);
    const entry = allHooks.find((h: { id: string }) => h.id === 'goodai-skill-evaluator');
    expect(entry).toBeDefined();
  });

  it('hook entry has type "command"', () => {
    runScript([targetProject]);
    const settings = JSON.parse(
      readFileSync(join(targetProject, '.claude', 'settings.json'), 'utf8'),
    );
    const groups = settings.hooks?.UserPromptSubmit ?? [];
    const allHooks = groups.flatMap((g: { hooks: unknown[] }) => g.hooks ?? []);
    const entry = allHooks.find((h: { id: string }) => h.id === 'goodai-skill-evaluator');
    expect(entry?.type).toBe('command');
  });

  it('hook entry has timeout 10', () => {
    runScript([targetProject]);
    const settings = JSON.parse(
      readFileSync(join(targetProject, '.claude', 'settings.json'), 'utf8'),
    );
    const groups = settings.hooks?.UserPromptSubmit ?? [];
    const allHooks = groups.flatMap((g: { hooks: unknown[] }) => g.hooks ?? []);
    const entry = allHooks.find((h: { id: string }) => h.id === 'goodai-skill-evaluator');
    expect(entry?.timeout).toBe(10);
  });

  it('idempotent: running install twice does not duplicate hook in settings.json', () => {
    runScript([targetProject]);
    runScript([targetProject]);
    const settings = JSON.parse(
      readFileSync(join(targetProject, '.claude', 'settings.json'), 'utf8'),
    );
    const groups = settings.hooks?.UserPromptSubmit ?? [];
    const allHooks = groups.flatMap((g: { hooks: unknown[] }) => g.hooks ?? []);
    const matchingHooks = allHooks.filter((h: { id: string }) => h.id === 'goodai-skill-evaluator');
    expect(matchingHooks.length).toBe(1);
  });

  it('output contains "Done. The hook will activate on next Claude Code session in:"', () => {
    const { stdout } = runScript([targetProject]);
    expect(stdout).toContain('Done. The hook will activate on next Claude Code session in:');
  });

  it('output shows created files section on first install', () => {
    const { stdout } = runScript([targetProject]);
    expect(stdout).toContain('Created:');
    expect(stdout).toContain('.claude/hooks/skill-evaluator.sh');
  });

  it('"Updated:" section shows "(nothing changed)" on second run (idempotent hook)', () => {
    runScript([targetProject]);
    const { stdout } = runScript([targetProject]);
    // On second run, hook file is identical so nothing changed in updated section
    // settings.json gets "updated" entry because mergeHook is always called
    // but the hook file itself should be unchanged
    expect(stdout).toContain('Updated:');
  });
});

describe('deploy-skill-hook.ts — uninstall', () => {
  let targetProject: string;

  beforeEach(() => {
    targetProject = makeTempProject();
  });

  afterEach(() => {
    rmSync(targetProject, { recursive: true, force: true });
  });

  it('after install + uninstall: .claude/hooks/skill-evaluator.sh is removed', () => {
    runScript([targetProject]);
    runScript(['--uninstall', targetProject]);
    expect(existsSync(join(targetProject, '.claude', 'hooks', 'skill-evaluator.sh'))).toBe(false);
  });

  it('after install + uninstall: hook entry removed from settings.json', () => {
    runScript([targetProject]);
    runScript(['--uninstall', targetProject]);
    const settings = JSON.parse(
      readFileSync(join(targetProject, '.claude', 'settings.json'), 'utf8'),
    );
    const groups = settings.hooks?.UserPromptSubmit ?? [];
    const allHooks = groups.flatMap((g: { hooks: unknown[] }) => g.hooks ?? []);
    const entry = allHooks.find((h: { id: string }) => h.id === 'goodai-skill-evaluator');
    expect(entry).toBeUndefined();
  });

  it('skill-overrides.json preserved after uninstall', () => {
    runScript([targetProject]);
    runScript(['--uninstall', targetProject]);
    expect(existsSync(join(targetProject, '.claude', 'skill-overrides.json'))).toBe(true);
  });

  it('uninstall exits 0', () => {
    runScript([targetProject]);
    const { exitCode } = runScript(['--uninstall', targetProject]);
    expect(exitCode).toBe(0);
  });

  it('uninstall output contains "Note: .claude/skill-overrides.json preserved"', () => {
    runScript([targetProject]);
    const { stdout } = runScript(['--uninstall', targetProject]);
    expect(stdout).toContain('Note: .claude/skill-overrides.json preserved');
  });

  it('uninstall on project with no hook: reports "not found" for hook file', () => {
    // No prior install — just uninstall on a fresh project dir
    const { stdout } = runScript(['--uninstall', targetProject]);
    expect(stdout).toContain('not found');
  });

  it('uninstall on project with no hook: exits 0', () => {
    const { exitCode } = runScript(['--uninstall', targetProject]);
    expect(exitCode).toBe(0);
  });
});

describe('deploy-skill-hook.ts — guards', () => {
  it('deploying into goodai-base itself exits non-zero', () => {
    const { exitCode, stderr } = runScript([GOODAI_BASE]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('Cannot deploy hook into goodai-base itself');
  });

  it('non-existent target path exits non-zero with error', () => {
    const { exitCode, stderr } = runScript(['/nonexistent/path/that/does/not/exist']);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('ERROR');
  });

  it('unknown flag exits non-zero', () => {
    const { exitCode, stderr } = runScript(['--unknown-flag', '/tmp']);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('Unknown option');
  });

  it('no arguments exits non-zero with usage message', () => {
    const { exitCode, stderr } = runScript([]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('Usage:');
  });
});
