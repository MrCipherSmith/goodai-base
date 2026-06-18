#!/usr/bin/env bun
// goodai-graph.ts — Query GoodAI Graph.

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOption, parseArgs } from './shared/args.js';
import { buildGoodaiGraph, impact, readGraph, routeRequest, why } from './shared/goodai-graph.js';
import { fileExists } from './shared/fs-utils.js';

const SCRIPT_DIR = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const args = parseArgs(process.argv.slice(2));
const command = args.positional[0];
const input = args.positional.slice(1).join(' ');
const repoRoot = resolve(getOption(args, 'repo-root', REPO_ROOT));
const graphPath = resolve(getOption(args, 'graph', join(repoRoot, 'docs', 'goodai-graph.json')));
const graph = fileExists(graphPath) ? readGraph(graphPath) : buildGoodaiGraph(repoRoot);

if (!command || !['route', 'impact', 'why'].includes(command)) {
  console.error('Usage: bun src/goodai-graph.ts <route|impact|why> <request-or-node>');
  process.exit(1);
}

if (!input) {
  console.error(`ERROR: ${command} requires an argument`);
  process.exit(1);
}

if (command === 'route') {
  console.log(JSON.stringify(routeRequest(graph, input), null, 2));
} else if (command === 'impact') {
  console.log(JSON.stringify(impact(graph, input), null, 2));
} else if (command === 'why') {
  console.log(JSON.stringify(why(graph, input), null, 2));
}

