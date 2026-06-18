import { readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { parseAgentsMd } from './agents-md.js';
import { parseRuleFrontmatter, parseSkillFrontmatter } from './frontmatter.js';
import { fileExists, readTextFile, writeTextFile } from './fs-utils.js';

export type GraphNodeType = 'skill' | 'rule' | 'schema' | 'plugin' | 'script' | 'doc' | 'intent';
export type GraphEdgeType =
  | 'loads_rule'
  | 'uses_schema'
  | 'dispatches_skill'
  | 'bundled_in_plugin'
  | 'generated_by_script'
  | 'documents'
  | 'matches_intent';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  name: string;
  path?: string;
  description?: string;
  keywords?: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
  source?: string;
  evidence?: string;
  required?: boolean;
}

export interface GoodaiGraph {
  schema_version: '1.0';
  generated_at: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ValidationFinding {
  severity: 'error' | 'warning';
  source: string;
  target: string;
  edge_type: GraphEdgeType;
  message: string;
  suggested_fix: string;
}

export interface RouteCandidate {
  node_id: string;
  type: GraphNodeType;
  score: number;
  reasons: string[];
  required_artifacts: string[];
}

export interface RouteResult {
  request: string;
  candidates: RouteCandidate[];
  policy_notes: string[];
}

const SKIP_SKILL_DIRS = new Set(['shared']);
const PRIMARY_ENTRYPOINTS = ['doc:AGENTS.md', 'doc:README.md', 'doc:docs/README.md'];

function walkFiles(dir: string, predicate: (path: string) => boolean, out: string[] = []): string[] {
  if (!fileExists(dir)) return out;
  for (const entry of readdirSync(dir).sort()) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkFiles(fullPath, predicate, out);
    } else if (predicate(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function rel(repoRoot: string, filePath: string): string {
  return relative(repoRoot, filePath).replace(/\\/g, '/');
}

function slugFromPath(filePath: string): string {
  return basename(filePath, extname(filePath));
}

function words(input: string): string[] {
  const normalized = input
    .toLowerCase()
    .replace(/[`"'(){}\[\],.:;!?/\\|_-]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3);
  const expanded = new Set<string>();
  for (const word of normalized) {
    expanded.add(word);
    if (word.endsWith('s') && word.length > 4) expanded.add(word.slice(0, -1));
    if (word.endsWith('ing') && word.length > 6) expanded.add(word.slice(0, -3));
  }
  return [...expanded];
}

function normalizeIdText(id: string): string {
  return id.replace(/^[^:]+:/, '').replace(/[._/-]+/g, ' ').toLowerCase();
}

function addNode(nodes: Map<string, GraphNode>, node: GraphNode): void {
  nodes.set(node.id, {
    ...node,
    keywords: Array.from(new Set(node.keywords ?? [])).sort(),
  });
}

function addEdge(edges: GraphEdge[], edge: GraphEdge): void {
  if (edge.from === edge.to) return;
  const exists = edges.some(
    (candidate) =>
      candidate.from === edge.from &&
      candidate.to === edge.to &&
      candidate.type === edge.type &&
      candidate.source === edge.source,
  );
  if (!exists) edges.push(edge);
}

function extractReferences(content: string, patterns: RegExp[]): string[] {
  const refs = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) refs.add(match[1]);
    }
  }
  return [...refs].sort();
}

function readJsonArrayField(filePath: string, field: string): string[] {
  try {
    const json = JSON.parse(readTextFile(filePath)) as Record<string, unknown>;
    const value = json[field];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function buildGoodaiGraph(repoRoot: string, generatedAt = new Date().toISOString()): GoodaiGraph {
  const root = resolve(repoRoot);
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  const agentsPath = join(root, 'AGENTS.md');
  if (fileExists(agentsPath)) {
    addNode(nodes, {
      id: 'doc:AGENTS.md',
      type: 'doc',
      name: 'AGENTS.md',
      path: 'AGENTS.md',
      description: 'Always-on routing table',
      keywords: ['routing', 'skills', 'rules'],
    });
  }

  for (const docPath of ['README.md', 'docs/README.md']) {
    const fullPath = join(root, docPath);
    if (fileExists(fullPath)) {
      addNode(nodes, {
        id: `doc:${docPath}`,
        type: 'doc',
        name: docPath,
        path: docPath,
        keywords: words(docPath),
      });
    }
  }

  const rulesDir = join(root, 'rules', 'core');
  for (const filePath of walkFiles(rulesDir, (path) => path.endsWith('.mdc'))) {
    const path = rel(root, filePath);
    const id = `rule:${slugFromPath(filePath)}`;
    const raw = readTextFile(filePath);
    const { data } = parseRuleFrontmatter(raw);
    addNode(nodes, {
      id,
      type: 'rule',
      name: slugFromPath(filePath),
      path,
      description: data.description,
      keywords: words(`${slugFromPath(filePath)} ${data.description ?? ''}`),
    });
    addEdge(edges, { from: 'doc:AGENTS.md', to: id, type: 'documents', source: 'AGENTS.md' });
  }

  const schemaFiles = [
    ...walkFiles(join(root, 'rules', 'schemas'), (path) => path.endsWith('.json')),
    ...walkFiles(join(root, 'skills'), (path) => path.endsWith('.schema.json')),
  ];
  const schemaPaths = new Set(schemaFiles.map((filePath) => rel(root, filePath)));
  const schemaBasenameMap = new Map<string, string[]>();
  for (const filePath of schemaFiles) {
    const path = rel(root, filePath);
    const sameName = schemaBasenameMap.get(basename(filePath)) ?? [];
    sameName.push(path);
    schemaBasenameMap.set(basename(filePath), sameName);
    addNode(nodes, {
      id: `schema:${path}`,
      type: 'schema',
      name: basename(filePath),
      path,
      keywords: words(path),
    });
  }

  const skillsDir = join(root, 'skills');
  if (fileExists(skillsDir)) {
    for (const dirName of readdirSync(skillsDir).sort()) {
      if (SKIP_SKILL_DIRS.has(dirName)) continue;
      const dirPath = join(skillsDir, dirName);
      if (!statSync(dirPath).isDirectory()) continue;
      const skillPath = join(dirPath, 'SKILL.md');
      if (!fileExists(skillPath)) continue;
      const raw = readTextFile(skillPath);
      const { data, content } = parseSkillFrontmatter(raw);
      const name = data.name || dirName;
      const description = data.description ?? '';
      const skillId = `skill:${name}`;
      const triggerWords = Array.isArray(data.triggers)
        ? data.triggers.filter((item): item is string => typeof item === 'string')
        : [];
      addNode(nodes, {
        id: skillId,
        type: 'skill',
        name,
        path: `skills/${dirName}/SKILL.md`,
        description,
        keywords: words(`${name} ${description} ${triggerWords.join(' ')}`),
      });
      addEdge(edges, { from: 'doc:AGENTS.md', to: skillId, type: 'documents', source: 'AGENTS.md' });

      for (const schemaRef of extractReferences(raw, [/([\w./-]+\.schema\.json)/g])) {
        const localSchema = `skills/${dirName}/${schemaRef}`;
        const basenameMatches = schemaBasenameMap.get(basename(schemaRef)) ?? [];
        const normalized = schemaRef.startsWith('skills/') || schemaRef.startsWith('rules/')
          ? schemaRef
          : schemaPaths.has(localSchema)
            ? localSchema
            : basenameMatches.length === 1
              ? basenameMatches[0]!
              : localSchema;
        addEdge(edges, {
          from: skillId,
          to: `schema:${normalized}`,
          type: 'uses_schema',
          source: `skills/${dirName}/SKILL.md`,
          evidence: schemaRef,
          required: true,
        });
      }

      for (const ruleRef of extractReferences(raw, [/rules\/core\/([\w.-]+\.mdc)/g, /core\/([\w.-]+\.mdc)/g])) {
        addEdge(edges, {
          from: skillId,
          to: `rule:${ruleRef.replace(/\.mdc$/, '')}`,
          type: 'loads_rule',
          source: `skills/${dirName}/SKILL.md`,
          evidence: ruleRef,
          required: false,
        });
      }

      for (const otherSkill of extractReferences(content, [/skills\/([\w-]+)\/SKILL\.md/g, /Load skill:\s*skills\/([\w-]+)\/SKILL\.md/g])) {
        addEdge(edges, {
          from: skillId,
          to: `skill:${otherSkill}`,
          type: 'dispatches_skill',
          source: `skills/${dirName}/SKILL.md`,
          evidence: otherSkill,
          required: false,
        });
      }
    }
  }

  const pluginDirs = walkFiles(join(root, 'plugins'), (path) => path.endsWith('.codex-plugin/plugin.json'));
  for (const pluginJson of pluginDirs) {
    const pluginRoot = pluginJson.replace(/\/\.codex-plugin\/plugin\.json$/, '');
    const pluginPath = rel(root, pluginRoot);
    const pluginName = basename(pluginRoot);
    const pluginId = `plugin:${pluginName}`;
    addNode(nodes, {
      id: pluginId,
      type: 'plugin',
      name: pluginName,
      path: pluginPath,
      keywords: words(pluginName),
    });
    for (const skillFile of walkFiles(join(pluginRoot, 'skills'), (path) => path.endsWith('/SKILL.md'))) {
      const skillName = basename(resolve(skillFile, '..'));
      addEdge(edges, {
        from: pluginId,
        to: `skill:${skillName}`,
        type: 'bundled_in_plugin',
        source: pluginPath,
        required: true,
      });
    }
  }

  for (const filePath of walkFiles(join(root, 'scripts', 'src'), (path) => path.endsWith('.ts'))) {
    const path = rel(root, filePath);
    addNode(nodes, {
      id: `script:${path}`,
      type: 'script',
      name: basename(filePath),
      path,
      keywords: words(path),
    });
  }

  for (const filePath of walkFiles(join(root, 'docs'), (path) => path.endsWith('.md') || path.endsWith('.yaml'))) {
    const path = rel(root, filePath);
    addNode(nodes, {
      id: `doc:${path}`,
      type: 'doc',
      name: path,
      path,
      keywords: words(path),
    });
  }

  for (const [script, outputs] of [
    ['scripts/src/generate-skill-catalog.ts', ['docs/skill-catalog.md', 'docs/ai/skill-catalog.yaml']],
    ['scripts/src/generate-rules-catalog.ts', ['docs/rules-catalog.md']],
    ['scripts/src/generate-codex-plugins.ts', ['plugins/goodai-base', 'plugins/goodai-core', 'plugins/goodai-review']],
  ] as const) {
    for (const output of outputs) {
      addEdge(edges, {
        from: `script:${script}`,
        to: output.startsWith('plugins/') ? `plugin:${basename(output)}` : `doc:${output}`,
        type: 'generated_by_script',
        source: script,
        required: false,
      });
    }
  }

  const rulesJsonPath = join(root, 'rules.json');
  if (fileExists(rulesJsonPath)) {
    try {
      const registry = JSON.parse(readTextFile(rulesJsonPath)) as { entries?: Array<{ id?: string; type?: string; triggers?: { keywords?: string[] } }> };
      for (const entry of registry.entries ?? []) {
        if (!entry.id || (entry.type !== 'skill' && entry.type !== 'rule')) continue;
        const targetId = `${entry.type}:${entry.id}`;
        const keywords = entry.triggers?.keywords ?? [];
        for (const keyword of keywords) {
          const intentId = `intent:${keyword.toLowerCase().replace(/\s+/g, '-')}`;
          addNode(nodes, { id: intentId, type: 'intent', name: keyword, keywords: words(keyword) });
          addEdge(edges, { from: intentId, to: targetId, type: 'matches_intent', source: 'rules.json', evidence: keyword });
        }
      }
    } catch {
      // rules.json validation is handled by validate-rules-json.ts.
    }
  }

  if (fileExists(agentsPath)) {
    const parsed = parseAgentsMd(readTextFile(agentsPath));
    for (const rule of parsed.rules) {
      addEdge(edges, {
        from: 'doc:AGENTS.md',
        to: `rule:${basename(rule.path, '.mdc')}`,
        type: 'documents',
        source: 'AGENTS.md',
        evidence: rule.description,
      });
    }
    for (const skill of parsed.skills) {
      addEdge(edges, {
        from: 'doc:AGENTS.md',
        to: `skill:${skill.name}`,
        type: 'documents',
        source: 'AGENTS.md',
        evidence: skill.description,
      });
    }
  }

  return {
    schema_version: '1.0',
    generated_at: generatedAt,
    nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => `${a.from}|${a.type}|${a.to}|${a.source ?? ''}`.localeCompare(`${b.from}|${b.type}|${b.to}|${b.source ?? ''}`)),
  };
}

export function validateGoodaiGraph(graph: GoodaiGraph): ValidationFinding[] {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const findings: ValidationFinding[] = [];

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from)) {
      findings.push({
        severity: edge.required ? 'error' : 'warning',
        source: edge.source ?? edge.from,
        target: edge.from,
        edge_type: edge.type,
        message: `Missing source node: ${edge.from}`,
        suggested_fix: `Add ${edge.from} to the graph or remove the stale edge.`,
      });
    }
    if (!nodeIds.has(edge.to)) {
      findings.push({
        severity: edge.required ? 'error' : 'warning',
        source: edge.source ?? edge.from,
        target: edge.to,
        edge_type: edge.type,
        message: `Missing target node: ${edge.to}`,
        suggested_fix: `Create the referenced artifact or update the reference in ${edge.source ?? edge.from}.`,
      });
    }
  }

  const connected = new Set<string>();
  for (const edge of graph.edges) {
    connected.add(edge.from);
    connected.add(edge.to);
  }
  for (const node of graph.nodes) {
    if (!connected.has(node.id) && !PRIMARY_ENTRYPOINTS.includes(node.id)) {
      findings.push({
        severity: 'warning',
        source: node.path ?? node.id,
        target: node.id,
        edge_type: 'documents',
        message: `Orphan candidate: ${node.id}`,
        suggested_fix: 'Connect this node to a routing, documentation, plugin, or generation edge if it is intended to be discoverable.',
      });
    }
  }

  return findings.sort((a, b) => `${a.severity}|${a.source}|${a.target}`.localeCompare(`${b.severity}|${b.source}|${b.target}`));
}

export function routeRequest(graph: GoodaiGraph, request: string): RouteResult {
  const requestWords = words(request);
  const requestLower = request.toLowerCase();
  const standardsRequest = /\bhow should\b|\bstandard(s)?\b|\bformat\b|\bwrite\b/i.test(request);
  const reviewRequest = /\breview\b|ревью|code review/i.test(request);
  const candidates: RouteCandidate[] = [];
  const targetNodes = graph.nodes.filter((node) => node.type === 'skill' || node.type === 'rule');

  for (const node of targetNodes) {
    let score = 0;
    let routingEvidence = false;
    const reasons: string[] = [];
    const nameText = normalizeIdText(node.id);
    const nodeWords = new Set([...(node.keywords ?? []), ...words(`${node.name} ${node.description ?? ''}`), ...words(nameText)]);
    const explicitPattern = new RegExp(`(^|\\s)${node.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[-\\s]')}(\\s|$)`, 'i');

    if (explicitPattern.test(requestLower) || requestLower.includes(node.id.toLowerCase())) {
      score += 100;
      routingEvidence = true;
      reasons.push('explicit skill/rule mention');
    }

    const overlap = requestWords.filter((word) => nodeWords.has(word));
    if (overlap.length > 0) {
      score += overlap.length * 8;
      routingEvidence = true;
      reasons.push(`keyword overlap: ${overlap.slice(0, 5).join(', ')}`);
    }

    const intentEdges = graph.edges.filter((edge) => edge.type === 'matches_intent' && edge.to === node.id);
    const matchedIntent = intentEdges.find((edge) => edge.evidence && requestLower.includes(edge.evidence.toLowerCase()));
    if (matchedIntent) {
      score += 35;
      routingEvidence = true;
      reasons.push(`intent graph match: ${matchedIntent.evidence}`);
    }

    if (standardsRequest && node.type === 'rule' && routingEvidence) {
      score += 55;
      reasons.push('standards/rules request');
    }
    if (standardsRequest && node.type === 'skill' && routingEvidence) {
      score -= 15;
    }
    if (reviewRequest && node.id === 'skill:review-orchestrator') {
      score += 80;
      routingEvidence = true;
      reasons.push('review-domain entrypoint');
    }

    const dependencyEdges = graph.edges.filter((edge) => edge.from === node.id && (edge.type === 'loads_rule' || edge.type === 'uses_schema'));
    if (dependencyEdges.length > 0 && routingEvidence) {
      score += Math.min(10, dependencyEdges.length * 2);
      reasons.push(`dependency graph available: ${dependencyEdges.length} artifact(s)`);
    }

    const pluginEdges = graph.edges.filter((edge) => edge.to === node.id && edge.type === 'bundled_in_plugin');
    if (pluginEdges.length > 0 && routingEvidence) {
      score += 5;
      reasons.push(`plugin availability: ${pluginEdges.map((edge) => edge.from.replace(/^plugin:/, '')).slice(0, 3).join(', ')}`);
    }

    if (!routingEvidence || score <= 0) continue;
    candidates.push({
      node_id: node.id,
      type: node.type,
      score,
      reasons,
      required_artifacts: dependencyEdges.map((edge) => edge.to).sort(),
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.node_id.localeCompare(b.node_id));

  const policyNotes: string[] = [];
  const hasExplicitSkill = candidates[0]?.reasons.includes('explicit skill/rule mention') ?? false;
  if (reviewRequest && !hasExplicitSkill) {
    policyNotes.push('AGENTS.md orchestrator-routing confirmation may apply before dispatching a review skill.');
  }

  return {
    request,
    candidates: candidates.slice(0, 10),
    policy_notes: policyNotes,
  };
}

export function impact(graph: GoodaiGraph, idOrPath: string): { node_id: string; direct: GraphNode[]; transitive: GraphNode[] } {
  const node = resolveNode(graph, idOrPath);
  if (!node) return { node_id: idOrPath, direct: [], transitive: [] };
  const byId = new Map(graph.nodes.map((item) => [item.id, item]));
  const directIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.from === node.id) directIds.add(edge.to);
    if (edge.to === node.id) directIds.add(edge.from);
  }

  const transitiveIds = new Set<string>();
  const queue = [...directIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.from !== current || edge.to === node.id || directIds.has(edge.to) || transitiveIds.has(edge.to)) continue;
      transitiveIds.add(edge.to);
      queue.push(edge.to);
    }
  }

  return {
    node_id: node.id,
    direct: [...directIds].map((id) => byId.get(id)).filter((item): item is GraphNode => item !== undefined).sort((a, b) => a.id.localeCompare(b.id)),
    transitive: [...transitiveIds].map((id) => byId.get(id)).filter((item): item is GraphNode => item !== undefined).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function why(graph: GoodaiGraph, idOrPath: string): { node_id: string; incoming: GraphEdge[]; outgoing: GraphEdge[] } {
  const node = resolveNode(graph, idOrPath);
  const id = node?.id ?? idOrPath;
  return {
    node_id: id,
    incoming: graph.edges.filter((edge) => edge.to === id),
    outgoing: graph.edges.filter((edge) => edge.from === id),
  };
}

export function resolveNode(graph: GoodaiGraph, idOrPath: string): GraphNode | undefined {
  return graph.nodes.find((node) => node.id === idOrPath || node.path === idOrPath || node.path?.endsWith(idOrPath));
}

export function writeGraphArtifacts(graph: GoodaiGraph, docsDir: string): void {
  writeTextFile(join(docsDir, 'goodai-graph.json'), JSON.stringify(graph, null, 2) + '\n');
  writeTextFile(join(docsDir, 'goodai-graph.md'), generateGraphMarkdown(graph, validateGoodaiGraph(graph)));
}

export function generateGraphMarkdown(graph: GoodaiGraph, findings: ValidationFinding[]): string {
  const counts = new Map<GraphNodeType, number>();
  for (const node of graph.nodes) counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  const edgeCounts = new Map<GraphEdgeType, number>();
  for (const edge of graph.edges) edgeCounts.set(edge.type, (edgeCounts.get(edge.type) ?? 0) + 1);
  const errors = findings.filter((finding) => finding.severity === 'error');
  const warnings = findings.filter((finding) => finding.severity === 'warning');

  return [
    '# GoodAI Graph',
    '',
    '_Auto-generated from repository skills, rules, schemas, plugins, scripts, and docs._',
    '',
    `Generated at: ${graph.generated_at}`,
    '',
    '## Summary',
    '',
    `- Nodes: ${graph.nodes.length}`,
    `- Edges: ${graph.edges.length}`,
    `- Validation errors: ${errors.length}`,
    `- Validation warnings: ${warnings.length}`,
    '',
    '## Node Counts',
    '',
    ...[...counts.entries()].sort().map(([type, count]) => `- ${type}: ${count}`),
    '',
    '## Edge Counts',
    '',
    ...[...edgeCounts.entries()].sort().map(([type, count]) => `- ${type}: ${count}`),
    '',
    '## Routing Coverage',
    '',
    `- Skill/rule candidates: ${graph.nodes.filter((node) => node.type === 'skill' || node.type === 'rule').length}`,
    `- Intent edges: ${graph.edges.filter((edge) => edge.type === 'matches_intent').length}`,
    `- Dependency edges: ${graph.edges.filter((edge) => edge.type === 'loads_rule' || edge.type === 'uses_schema').length}`,
    '',
    '## Findings',
    '',
    findings.length === 0
      ? 'No validation findings.'
      : findings.slice(0, 50).map((finding) => `- ${finding.severity.toUpperCase()}: ${finding.message} (${finding.source} -> ${finding.target})`).join('\n'),
    '',
  ].join('\n');
}

export function readGraph(filePath: string): GoodaiGraph {
  return JSON.parse(readTextFile(filePath)) as GoodaiGraph;
}
