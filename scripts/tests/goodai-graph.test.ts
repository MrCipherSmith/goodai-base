import { describe, expect, it } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildGoodaiGraph, routeRequest, validateGoodaiGraph } from '../src/shared/goodai-graph.js';

function makeRepo(): string {
  const root = join(tmpdir(), `goodai-graph-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, 'skills', 'review-orchestrator'), { recursive: true });
  mkdirSync(join(root, 'skills', 'code-ai-review'), { recursive: true });
  mkdirSync(join(root, 'rules', 'core'), { recursive: true });
  mkdirSync(join(root, 'rules', 'schemas'), { recursive: true });
  mkdirSync(join(root, 'plugins', 'goodai-review', '.codex-plugin'), { recursive: true });
  mkdirSync(join(root, 'plugins', 'goodai-review', 'skills', 'review-orchestrator'), { recursive: true });
  mkdirSync(join(root, 'scripts', 'src'), { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });

  writeFileSync(
    join(root, 'AGENTS.md'),
    `# AGENTS

## 📖 Core Rule Catalog
- \`core/review-agent-profile.mdc\`: Baseline review standards

## 🎨 Skills Catalog
**\`skills/review-orchestrator\`**
Purpose: Entry point for code review
`,
  );
  writeFileSync(join(root, 'README.md'), '# fixture\n');
  writeFileSync(join(root, 'docs', 'README.md'), '# docs\n');
  writeFileSync(
    join(root, 'rules', 'core', 'review-agent-profile.mdc'),
    `---\ndescription: "Baseline review standards"\n---\n# Review\n`,
  );
  writeFileSync(join(root, 'rules', 'schemas', 'skill-workflow-result.schema.json'), '{}\n');
  writeFileSync(
    join(root, 'skills', 'review-orchestrator', 'SKILL.md'),
    `---\nname: review-orchestrator\ndescription: "Use when review, code review, review PR"\ntriggers:\n  - "Review my code"\nmetadata:\n  category: review\n---\n# Review\nUses rules/core/review-agent-profile.mdc and input-contract.schema.json.\n`,
  );
  writeFileSync(join(root, 'skills', 'review-orchestrator', 'input-contract.schema.json'), '{}\n');
  writeFileSync(
    join(root, 'skills', 'code-ai-review', 'SKILL.md'),
    `---\nname: code-ai-review\ndescription: "Use when strict AI review is requested"\nmetadata:\n  category: review\n---\n# Code AI Review\n`,
  );
  writeFileSync(join(root, 'plugins', 'goodai-review', '.codex-plugin', 'plugin.json'), '{"name":"goodai-review"}\n');
  writeFileSync(join(root, 'plugins', 'goodai-review', 'skills', 'review-orchestrator', 'SKILL.md'), '# copied\n');
  writeFileSync(join(root, 'scripts', 'src', 'generate-skill-catalog.ts'), '// fixture\n');
  writeFileSync(
    join(root, 'rules.json'),
    JSON.stringify(
      {
        entries: [
          { id: 'review-orchestrator', type: 'skill', triggers: { keywords: ['review', 'code review'] } },
          { id: 'code-ai-review', type: 'skill', triggers: { keywords: ['code-ai-review'] } },
          { id: 'review-agent-profile', type: 'rule', triggers: { keywords: ['review standards'] } },
        ],
      },
      null,
      2,
    ),
  );

  return root;
}

describe('GoodAI Graph', () => {
  it('generates deterministic nodes and edges for canonical entities', () => {
    const root = makeRepo();
    try {
      const graph = buildGoodaiGraph(root, '2026-06-17T00:00:00.000Z');
      expect(graph.nodes.some((node) => node.id === 'skill:review-orchestrator')).toBe(true);
      expect(graph.nodes.some((node) => node.id === 'rule:review-agent-profile')).toBe(true);
      expect(graph.nodes.some((node) => node.id === 'schema:skills/review-orchestrator/input-contract.schema.json')).toBe(true);
      expect(graph.edges.some((edge) => edge.type === 'loads_rule')).toBe(true);
      expect(graph.edges.some((edge) => edge.type === 'uses_schema')).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('validates missing required schema references as errors', () => {
    const root = makeRepo();
    try {
      writeFileSync(
        join(root, 'skills', 'review-orchestrator', 'SKILL.md'),
        `---\nname: review-orchestrator\ndescription: "Use when review"\n---\n# Review\nUses missing.schema.json.\n`,
      );
      const graph = buildGoodaiGraph(root, '2026-06-17T00:00:00.000Z');
      const findings = validateGoodaiGraph(graph);
      expect(findings.some((finding) => finding.severity === 'error' && finding.target.includes('missing.schema.json'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('routes explicit skill mentions above inferred review matches', () => {
    const root = makeRepo();
    try {
      const graph = buildGoodaiGraph(root, '2026-06-17T00:00:00.000Z');
      const result = routeRequest(graph, 'Run code-ai-review on this branch');
      expect(result.candidates[0]?.node_id).toBe('skill:code-ai-review');
      expect(result.candidates[0]?.reasons).toContain('explicit skill/rule mention');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('routes standards requests to matching rules', () => {
    const root = makeRepo();
    try {
      const graph = buildGoodaiGraph(root, '2026-06-17T00:00:00.000Z');
      const result = routeRequest(graph, 'What are the review standards?');
      expect(result.candidates.some((candidate) => candidate.node_id === 'rule:review-agent-profile')).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

