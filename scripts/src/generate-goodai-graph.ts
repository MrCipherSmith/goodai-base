#!/usr/bin/env bun
// generate-goodai-graph.ts — Generate GoodAI Graph artifacts.

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFlag, getOption, parseArgs } from './shared/args.js';
import { buildGoodaiGraph, validateGoodaiGraph, writeGraphArtifacts } from './shared/goodai-graph.js';

const SCRIPT_DIR = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const args = parseArgs(process.argv.slice(2));
const repoRoot = resolve(getOption(args, 'repo-root', REPO_ROOT));
const docsDir = resolve(getOption(args, 'docs-dir', join(repoRoot, 'docs')));
const dryRun = getFlag(args, 'dry-run');

const graph = buildGoodaiGraph(repoRoot);
const findings = validateGoodaiGraph(graph);

console.log(`Generated graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
console.log(`Validation: ${findings.filter((finding) => finding.severity === 'error').length} error(s), ${findings.filter((finding) => finding.severity === 'warning').length} warning(s)`);

if (dryRun) {
  console.log(`[DRY RUN] Would write: ${join(docsDir, 'goodai-graph.json')}`);
  console.log(`[DRY RUN] Would write: ${join(docsDir, 'goodai-graph.md')}`);
} else {
  writeGraphArtifacts(graph, docsDir);
  console.log(`Written: ${join(docsDir, 'goodai-graph.json')}`);
  console.log(`Written: ${join(docsDir, 'goodai-graph.md')}`);
}

