#!/usr/bin/env bun
// generate-zcode-plugin.ts - build a ZCode plugin bundle from goodai-base sources
//
// ZCode loads skills ONLY through its plugin/marketplace system, so unlike
// claude/cursor/codex we cannot drop files into a plain `~/.zcode/skills/`
// directory. This generator mirrors what `generate-codex-plugins.ts` does for
// Codex, but emits a single monolith bundle in the ZCode plugin format:
//
//   plugins/goodai-zcode/
//     .zcode-plugin/plugin.json   (name, version, description, author, ..., skills:"skills")
//     skills/<skill>/SKILL.md     (canonical SKILL.md for every skill)
//     skills/shared/              (reusable snippets)
//     AGENTS.md                   (router, copied verbatim)
//     README.md
//   .agents/zcode-plugins/marketplace.json
//
// The on-disk install into `~/.zcode/cli/plugins/` is performed by sync-zcode.ts.
//
// Usage:
//   bun src/generate-zcode-plugin.ts
//   bun src/generate-zcode-plugin.ts --check
//   bun src/generate-zcode-plugin.ts --repo-root <path> --output-root <path>

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const PLUGIN_NAME = 'goodai-zcode';
const MARKETPLACE_NAME = 'goodai-base';
const AUTHOR = {
  name: 'MrCipherSmith',
  url: 'https://github.com/MrCipherSmith',
};
const HOMEPAGE = 'https://github.com/MrCipherSmith/goodai-base';
const PLUGIN_DESCRIPTION =
  'All goodai-base skills and rules in one ZCode plugin.';

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

function pluginRoot(): string {
  return outputPath('plugins', PLUGIN_NAME);
}

function marketplacePath(): string {
  return outputPath('.agents', 'zcode-plugins', 'marketplace.json');
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

function copyDir(src: string, dest: string): void {
  cpSync(src, dest, {
    recursive: true,
    dereference: false,
    filter: (path) => !path.includes('/node_modules/') && !path.includes('/.git/'),
  });
}

function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(sourcePath('package.json'), 'utf8'));
  return pkg.version;
}

function generateMarketplace(version: string): void {
  // ZCode marketplace manifest: plugins point at their on-disk cache path with
  // source:"filesystem". The cachePath here is repo-relative and is rewritten to
  // an absolute `~/.zcode/...` path by sync-zcode.ts at install time.
  writeJson(marketplacePath(), {
    name: MARKETPLACE_NAME,
    plugins: [
      {
        cachePath: `./plugins/${PLUGIN_NAME}`,
        name: PLUGIN_NAME,
        source: 'filesystem',
        version,
      },
    ],
    version: 1,
  });
}

function generatePlugin(allSkills: string[]): void {
  const root = pluginRoot();
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });

  for (const skill of allSkills) {
    copyDir(sourcePath('skills', skill), join(root, 'skills', skill));
  }

  if (existsSync(sourcePath('skills', 'shared'))) {
    copyDir(sourcePath('skills', 'shared'), join(root, 'skills', 'shared'));
  }

  copyDir(sourcePath('rules'), join(root, 'rules'));
  copyDir(sourcePath('docs'), join(root, 'docs'));
  cpSync(sourcePath('AGENTS.md'), join(root, 'AGENTS.md'));
  cpSync(sourcePath('AGENTS.mdc'), join(root, 'AGENTS.mdc'));

  normalizeTextOutput(root);

  // ZCode plugin.json schema (see skill-creator / superpowers / document-skills
  // for reference). Note `skills` is a plain directory name, NOT a `./path/`.
  writeJson(join(root, '.zcode-plugin', 'plugin.json'), {
    name: PLUGIN_NAME,
    version: packageVersion(),
    description: PLUGIN_DESCRIPTION,
    author: AUTHOR,
    homepage: HOMEPAGE,
    repository: HOMEPAGE,
    license: 'MIT',
    skills: 'skills',
  });

  // ZCode plugins carry a package.json at the bundle root (every official plugin
  // has one). We emit a private manifest mirroring that convention.
  writeJson(join(root, 'package.json'), {
    $schema: 'https://json.schemastore.org/package.json',
    name: `@goodai/${PLUGIN_NAME}-plugin`,
    version: packageVersion(),
    private: true,
    license: 'MIT',
    description: PLUGIN_DESCRIPTION,
  });

  writeText(join(root, 'README.md'), pluginReadme(allSkills));
}

function pluginReadme(skills: string[]): string {
  return `# ${PLUGIN_NAME}

${PLUGIN_DESCRIPTION}

This plugin is generated from the canonical goodai-base repository. Do not edit
files here by hand; update the source skill/rule and run:

\`\`\`bash
cd scripts && bun run generate-zcode-plugin
\`\`\`

To install into ZCode:

\`\`\`bash
cd scripts && bun run sync-zcode
\`\`\`

## Included Skills

${skills.map((skill) => `- \`${skill}\``).join('\n')}

## Included References

- \`AGENTS.md\` — routing/router instructions
- \`rules/\` — coding standards
- \`docs/\` — generated catalogs
`;
}

function generateAll(): void {
  const allSkills = listSkillNames();
  const version = packageVersion();
  generateMarketplace(version);
  generatePlugin(allSkills);
  console.log(`Generated ZCode plugin "${PLUGIN_NAME}" at ${pluginRoot()}`);
  console.log(`Generated marketplace at ${marketplacePath()}`);
  console.log(`Included ${allSkills.length} skills`);
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
    join(expectedRoot, '.agents', 'zcode-plugins'),
    join(expectedRoot, 'plugins', PLUGIN_NAME),
  ];
  const actualPaths = [
    join(actualRoot, '.agents', 'zcode-plugins'),
    join(actualRoot, 'plugins', PLUGIN_NAME),
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
  const tempRoot = join(tmpdir(), `goodai-zcode-plugin-${Date.now()}`);
  try {
    activeOutputRoot = tempRoot;
    generateAll();
    const diffs = compareGenerated(tempRoot, initialOutputRoot);
    if (diffs.length > 0) {
      console.error('ERROR: ZCode plugin output is stale. Run: cd scripts && bun run generate-zcode-plugin');
      for (const diff of diffs.slice(0, 50)) {
        console.error(`- ${diff}`);
      }
      if (diffs.length > 50) {
        console.error(`...and ${diffs.length - 50} more`);
      }
      process.exit(1);
    }
    console.log('ZCode plugin output is up to date.');
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
