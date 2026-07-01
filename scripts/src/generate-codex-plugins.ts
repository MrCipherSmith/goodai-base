#!/usr/bin/env bun
// generate-codex-plugins.ts - build Codex plugin bundles from goodai-base sources
//
// Usage:
//   bun src/generate-codex-plugins.ts
//   bun src/generate-codex-plugins.ts --check

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';

interface PluginBundle {
  name: string;
  displayName: string;
  description: string;
  category: string;
  capabilities: string[];
  defaultPrompt: string[];
  skills: string[] | 'all';
}

const PLUGINS: PluginBundle[] = [
  {
    name: 'goodai-base',
    displayName: 'goodai-base',
    description: 'All goodai-base skills and rules in one Codex plugin.',
    category: 'Productivity',
    capabilities: ['Interactive', 'Write', 'Review'],
    defaultPrompt: [
      'Use goodai-base to choose the right workflow.',
      'Review my current branch with goodai-base.',
      'Plan and implement this issue end to end.',
    ],
    skills: 'all',
  },
  {
    name: 'goodai-core',
    displayName: 'goodai Core',
    description: 'Everyday workflow, git, audit, deployment, and utility skills.',
    category: 'Productivity',
    capabilities: ['Interactive', 'Write'],
    defaultPrompt: [
      'Commit my current changes.',
      'Create a pull request for this branch.',
      'Run a security or performance audit.',
    ],
    skills: [
      'brainstorm',
      'caveman-mode',
      'changelog',
      'claude-md-management',
      'commit',
      'db-migrate',
      'dependency-update',
      'deploy',
      'hookify',
      'interview',
      'interviewer',
      'perf-check',
      'pr',
      'push',
      'security-audit',
      'test-gen',
    ],
  },
  {
    name: 'goodai-review',
    displayName: 'goodai Review',
    description: 'Code review orchestrator and specialized review skills.',
    category: 'Developer Tools',
    capabilities: ['Interactive', 'Review'],
    defaultPrompt: [
      'Review my current branch.',
      'Run a frontend-focused review.',
      'Run a strict architecture review.',
    ],
    skills: [
      'code-ai-review',
      'code-boss-review',
      'code-mobx-store-review',
      'code-style-review',
      'review-architecture',
      'review-backend',
      'review-clean-code',
      'review-core-boundaries',
      'review-flow-graph',
      'review-frontend',
      'review-frontend-conventions',
      'review-greptile',
      'review-highload',
      'iago',
      'review-logic',
      'review-orchestrator',
      'review-performance',
      'review-pr-feedback',
      'review-security-code',
      'review-strict',
      'review-style',
      'review-testing-practices',
    ],
  },
  {
    name: 'goodai-orchestration',
    displayName: 'goodai Orchestration',
    description: 'Issue analysis, context collection, implementation, and verification workflows.',
    category: 'Developer Tools',
    capabilities: ['Interactive', 'Write', 'Review'],
    defaultPrompt: [
      'Implement this issue end to end.',
      'Analyze this branch for implementation impact.',
      'Run verification for my changes.',
    ],
    skills: [
      'code-verifier',
      'context-collector',
      'feature-analyzer',
      'feature-dev',
      'issue-analyzer',
      'job-documenter',
      'job-orchestrator',
      'pr-issue-documenter',
      'task-implementer',
      'tests-creator',
    ],
  },
  {
    name: 'goodai-project-docs',
    displayName: 'goodai Project Docs',
    description: 'PRD, gproject, and autodoc documentation workflows.',
    category: 'Productivity',
    capabilities: ['Interactive', 'Write'],
    defaultPrompt: [
      'Create a PRD for this feature.',
      'Run the gproject planning pipeline.',
      'Generate developer docs for this codebase.',
    ],
    skills: [
      'autodoc-analyst',
      'autodoc-architect',
      'autodoc-assembler',
      'autodoc-orchestrator',
      'autodoc-scanner',
      'autodoc-writer',
      'gproject-consistency-checker',
      'gproject-discovery',
      'gproject-orchestrator',
      'gproject-patterns-researcher',
      'gproject-planner',
      'gproject-problem-definer',
      'gproject-spec-writer',
      'gproject-stack-advisor',
      'prd-creator',
      'spec-orchestrator',
      'brd-creator',
      'fsd-creator',
      'trd-creator',
    ],
  },
];

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const repoRoot = getOption('--repo-root') ?? resolve(import.meta.dir, '../..');
const initialOutputRoot = getOption('--output-root') ?? repoRoot;
let activeOutputRoot = initialOutputRoot;

function getOption(name: string): string | undefined {
  const idx = argv.indexOf(name);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

function sourcePath(...parts: string[]): string {
  return join(repoRoot, ...parts);
}

function outputPath(...parts: string[]): string {
  return join(activeOutputRoot, ...parts);
}

function pluginsRoot(): string {
  return outputPath('plugins');
}

function marketplacePath(): string {
  return outputPath('.agents', 'plugins', 'marketplace.json');
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, 'utf8');
}

function normalizeTextOutput(root: string): void {
  for (const file of listFiles(root)) {
    try {
      const text = readFileSync(file, 'utf8');
      const normalized = text.replace(/[ \t]+(\r?\n)/g, '$1').replace(/\s*$/, '\n');
      if (normalized !== text) {
        writeFileSync(file, normalized, 'utf8');
      }
    } catch {
      // Plugin bundles are text-first, but skip any binary file defensively.
    }
  }
}

function listSkillNames(): string[] {
  const skillsDir = sourcePath('skills');
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== 'shared')
    .filter((name) => existsSync(join(skillsDir, name, 'SKILL.md')))
    .sort();
}

function assertSkillExists(skillName: string): void {
  const skillPath = sourcePath('skills', skillName, 'SKILL.md');
  if (!existsSync(skillPath)) {
    throw new Error(`Bundle references missing skill: ${skillName}`);
  }
}

function bundleSkills(bundle: PluginBundle, allSkills: string[]): string[] {
  const skills = bundle.skills === 'all' ? allSkills : bundle.skills;
  for (const skill of skills) {
    assertSkillExists(skill);
  }
  return [...skills].sort();
}

function copyDir(src: string, dest: string): void {
  cpSync(src, dest, {
    recursive: true,
    dereference: false,
    filter: (path) => !path.includes('/node_modules/') && !path.includes('/.git/'),
  });
}

function generateMarketplace(): void {
  writeJson(marketplacePath(), {
    name: 'goodai-base',
    interface: {
      displayName: 'goodai-base',
    },
    plugins: PLUGINS.map((plugin) => ({
      name: plugin.name,
      source: {
        source: 'local',
        path: `./plugins/${plugin.name}`,
      },
      policy: {
        installation: 'AVAILABLE',
        authentication: 'ON_INSTALL',
      },
      category: plugin.category,
    })),
  });
}

function generatePlugin(bundle: PluginBundle, allSkills: string[]): void {
  const pluginRoot = outputPath('plugins', bundle.name);
  rmSync(pluginRoot, { recursive: true, force: true });
  mkdirSync(pluginRoot, { recursive: true });

  const skills = bundleSkills(bundle, allSkills);
  for (const skill of skills) {
    copyDir(sourcePath('skills', skill), join(pluginRoot, 'skills', skill));
  }

  if (existsSync(sourcePath('skills', 'shared'))) {
    copyDir(sourcePath('skills', 'shared'), join(pluginRoot, 'skills', 'shared'));
  }

  copyDir(sourcePath('rules'), join(pluginRoot, 'rules'));
  copyDir(sourcePath('docs'), join(pluginRoot, 'docs'));
  cpSync(sourcePath('AGENTS.md'), join(pluginRoot, 'AGENTS.md'));
  cpSync(sourcePath('AGENTS.mdc'), join(pluginRoot, 'AGENTS.mdc'));

  normalizeTextOutput(pluginRoot);

  writeJson(join(pluginRoot, '.codex-plugin', 'plugin.json'), {
    name: bundle.name,
    version: packageVersion(),
    description: bundle.description,
    author: {
      name: 'MrCipherSmith',
      url: 'https://github.com/MrCipherSmith',
    },
    homepage: 'https://github.com/MrCipherSmith/goodai-base',
    repository: 'https://github.com/MrCipherSmith/goodai-base',
    license: 'MIT',
    keywords: ['codex', 'skills', 'ai-agent', 'goodai-base'],
    skills: './skills/',
    interface: {
      displayName: bundle.displayName,
      shortDescription: bundle.description,
      longDescription: `${bundle.description} Generated from the canonical goodai-base skills and rules.`,
      developerName: 'MrCipherSmith',
      category: bundle.category,
      capabilities: bundle.capabilities,
      websiteURL: 'https://github.com/MrCipherSmith/goodai-base',
      defaultPrompt: bundle.defaultPrompt,
      brandColor: '#2563EB',
    },
  });

  writeText(join(pluginRoot, 'README.md'), pluginReadme(bundle, skills));
}

function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(sourcePath('package.json'), 'utf8'));
  return pkg.version;
}

function pluginReadme(bundle: PluginBundle, skills: string[]): string {
  return `# ${bundle.displayName}

${bundle.description}

This plugin is generated from the canonical goodai-base repository. Do not edit
files here by hand; update the source skill/rule and run:

\`\`\`bash
cd scripts && bun run generate-codex-plugins
\`\`\`

## Included Skills

${skills.map((skill) => `- \`${skill}\``).join('\n')}

## Included References

- \`AGENTS.md\`
- \`rules/\`
- \`docs/\`
`;
}

function generateAll(): void {
  const allSkills = listSkillNames();
  validateBundleCoverage(allSkills);
  generateMarketplace();
  for (const plugin of PLUGINS) {
    generatePlugin(plugin, allSkills);
  }
  console.log(`Generated ${PLUGINS.length} Codex plugins in ${pluginsRoot()}`);
  console.log(`Generated marketplace at ${marketplacePath()}`);
}

function validateBundleCoverage(allSkills: string[]): void {
  const bundled = new Set<string>();
  for (const plugin of PLUGINS.filter((plugin) => plugin.name !== 'goodai-base')) {
    for (const skill of bundleSkills(plugin, allSkills)) {
      bundled.add(skill);
    }
  }
  const missing = allSkills.filter((skill) => !bundled.has(skill));
  if (missing.length > 0) {
    throw new Error(`Non-monolith bundles do not include skills: ${missing.join(', ')}`);
  }
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function compareGenerated(expectedRoot: string, actualRoot: string): string[] {
  const expectedPaths = [
    join(expectedRoot, '.agents', 'plugins'),
    ...PLUGINS.map((plugin) => join(expectedRoot, 'plugins', plugin.name)),
  ];
  const actualPaths = [
    join(actualRoot, '.agents', 'plugins'),
    ...PLUGINS.map((plugin) => join(actualRoot, 'plugins', plugin.name)),
  ];

  const expectedFiles = new Map<string, string>();
  for (const expectedPath of expectedPaths) {
    for (const file of listFiles(expectedPath)) {
      expectedFiles.set(relative(expectedRoot, file), file);
    }
  }

  const actualFiles = new Map<string, string>();
  for (const actualPath of actualPaths) {
    for (const file of listFiles(actualPath)) {
      actualFiles.set(relative(actualRoot, file), file);
    }
  }

  const diffs: string[] = [];
  const allRelative = new Set([...expectedFiles.keys(), ...actualFiles.keys()]);
  for (const rel of [...allRelative].sort()) {
    const expectedFile = expectedFiles.get(rel);
    const actualFile = actualFiles.get(rel);
    if (!expectedFile) {
      diffs.push(`unexpected generated file: ${rel}`);
      continue;
    }
    if (!actualFile) {
      diffs.push(`missing generated file: ${rel}`);
      continue;
    }
    if (readFileSync(expectedFile, 'utf8') !== readFileSync(actualFile, 'utf8')) {
      diffs.push(`stale generated file: ${rel}`);
    }
  }
  return diffs;
}

function runCheck(): void {
  const tempRoot = join(tmpdir(), `goodai-codex-plugins-${Date.now()}`);
  try {
    activeOutputRoot = tempRoot;
    generateAll();
    const diffs = compareGenerated(tempRoot, initialOutputRoot);
    if (diffs.length > 0) {
      console.error('ERROR: Codex plugin output is stale. Run: cd scripts && bun run generate-codex-plugins');
      for (const diff of diffs.slice(0, 50)) {
        console.error(`- ${diff}`);
      }
      if (diffs.length > 50) {
        console.error(`...and ${diffs.length - 50} more`);
      }
      process.exit(1);
    }
    console.log('Codex plugin output is up to date.');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

try {
  if (checkOnly) {
    runCheck();
  } else {
    generateAll();
  }
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
