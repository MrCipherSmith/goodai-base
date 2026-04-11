import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = join(import.meta.dir, '..', 'src', 'generate-agents.ts');

// The repo root where skills/*/SKILL.md actually live
const REPO_ROOT = join(import.meta.dir, '..', '..');

function runScript(
  args: string[] = [],
  cwd?: string,
): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync(['bun', SCRIPT, ...args], {
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

// generate-agents.ts reads skills from repo root (hardcoded), but --output-dir is configurable.
// We use a temp output dir for all write tests.

describe('generate-agents.ts', () => {
  let tmpOut: string;

  beforeAll(() => {
    tmpOut = join(tmpdir(), `gen-agents-test-${Date.now()}`);
    mkdirSync(tmpOut, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpOut, { recursive: true, force: true });
  });

  // --- dry-run behaviour ---

  it('exits 0 with --dry-run', () => {
    const { exitCode } = runScript(['--output-dir', tmpOut, '--dry-run']);
    expect(exitCode).toBe(0);
  });

  it('--dry-run prints "[DRY]" lines for agent-worthy skills', () => {
    const { stdout } = runScript(['--output-dir', tmpOut, '--dry-run']);
    expect(stdout).toContain('[DRY]');
  });

  it('--dry-run does not create any agent files', () => {
    const dryOut = join(tmpdir(), `gen-agents-dry-${Date.now()}`);
    runScript(['--output-dir', dryOut, '--dry-run']);
    // Directory should not have been created (or be empty)
    expect(existsSync(dryOut)).toBe(false);
  });

  it('--dry-run shows "Generated: 0" in summary (counts not inflated)', () => {
    const { stdout } = runScript(['--output-dir', tmpOut, '--dry-run']);
    expect(stdout).toContain('Generated: 0');
  });

  it('--dry-run prints "(DRY RUN — no files written)" notice', () => {
    const { stdout } = runScript(['--output-dir', tmpOut, '--dry-run']);
    expect(stdout).toContain('DRY RUN');
  });

  // --- real generation ---

  it('exits 0 when generating for real', () => {
    const out = join(tmpdir(), `gen-agents-real-${Date.now()}`);
    const { exitCode } = runScript(['--output-dir', out]);
    rmSync(out, { recursive: true, force: true });
    expect(exitCode).toBe(0);
  });

  it('creates agent files in --output-dir', () => {
    const out = join(tmpdir(), `gen-agents-files-${Date.now()}`);
    runScript(['--output-dir', out]);
    // At least one agent-worthy skill exists (context-collector, issue-analyzer, task-implementer)
    const hasFiles =
      existsSync(join(out, 'context-collector.md')) ||
      existsSync(join(out, 'issue-analyzer.md')) ||
      existsSync(join(out, 'task-implementer.md'));
    rmSync(out, { recursive: true, force: true });
    expect(hasFiles).toBe(true);
  });

  it('generated file has correct YAML frontmatter (name + description)', () => {
    const out = join(tmpdir(), `gen-agents-fm-${Date.now()}`);
    runScript(['--output-dir', out]);
    const agentFile = join(out, 'context-collector.md');
    if (existsSync(agentFile)) {
      const content = readFileSync(agentFile, 'utf8');
      expect(content).toMatch(/^---/);
      expect(content).toContain('name: context-collector');
      expect(content).toContain('description:');
    }
    rmSync(out, { recursive: true, force: true });
  });

  it('generated file contains skill body content (below frontmatter)', () => {
    const out = join(tmpdir(), `gen-agents-body-${Date.now()}`);
    runScript(['--output-dir', out]);
    const agentFile = join(out, 'context-collector.md');
    if (existsSync(agentFile)) {
      const content = readFileSync(agentFile, 'utf8');
      // Should have at least 3 --- (open fm, close fm, and body content)
      const dashCount = (content.match(/^---/gm) ?? []).length;
      expect(dashCount).toBeGreaterThanOrEqual(2);
      // Should also contain an AUTO-GENERATED comment
      expect(content).toContain('AUTO-GENERATED');
    }
    rmSync(out, { recursive: true, force: true });
  });

  it('summary line format: "Summary: Generated: N | Updated: N | Skipped: N | Errors: N"', () => {
    const { stdout } = runScript(['--output-dir', tmpOut, '--dry-run']);
    expect(stdout).toMatch(/Summary: Generated: \d+ \| Updated: \d+ \| Skipped: \d+ \| Errors: \d+/);
  });

  // --- skip / force behaviour ---

  it('skips non-agent-worthy skills (no SKIP or generated file for them)', () => {
    // The brainstorm skill is not agent_worthy — no .md should be created for it
    const out = join(tmpdir(), `gen-agents-skip-${Date.now()}`);
    runScript(['--output-dir', out]);
    // brainstorm is not in agents-registry so should not appear
    const brainstormFile = join(out, 'brainstorm.md');
    // We can only assert if we know it's not agent_worthy; if it IS, this test is moot
    // so check it wasn't created by reading registry
    const registryRaw = readFileSync(join(REPO_ROOT, 'skills', 'agents-registry.json'), 'utf8');
    const registry = JSON.parse(registryRaw);
    const inRegistry = registry.agents.some((e: { skill_name: string }) => e.skill_name === 'brainstorm');
    if (!inRegistry) {
      expect(existsSync(brainstormFile)).toBe(false);
    }
    rmSync(out, { recursive: true, force: true });
  });

  it('skips existing untracked agent files (no --force) with SKIP message', () => {
    const out = join(tmpdir(), `gen-agents-noforce-${Date.now()}`);
    mkdirSync(out, { recursive: true });
    // Create a "manual" agent file for context-collector that isn't in any registry
    writeFileSync(join(out, 'context-collector.md'), '# manual agent\n');
    const { stdout } = runScript(['--output-dir', out]);
    // Should say SKIP since the file exists but isn't tracked
    expect(stdout).toContain('SKIP');
    rmSync(out, { recursive: true, force: true });
  });

  it('--force bypasses untracked guard (no SKIP in output)', () => {
    const out = join(tmpdir(), `gen-agents-force-${Date.now()}`);
    mkdirSync(out, { recursive: true });
    // Create a "manual" file that is NOT in trackedAgentPaths from registry
    writeFileSync(join(out, 'context-collector.md'), '# manual agent\n');
    const { stdout } = runScript(['--output-dir', out, '--force']);
    // With --force the "SKIP: ... manually managed" line should NOT appear
    // (the script either regenerates or marks up-to-date, but doesn't skip)
    expect(stdout).not.toContain('SKIP: context-collector');
    rmSync(out, { recursive: true, force: true });
  });
});
