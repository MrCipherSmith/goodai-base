#!/usr/bin/env bun
// sync-zcode.ts - install the goodai-zcode plugin into ZCode's plugin cache.
//
// ZCode discovers skills only through its plugin/marketplace system (it does
// NOT scan a plain skills directory). This script performs the file-drop
// install that mirrors how the official zcode-plugins-official marketplace is
// laid out on disk:
//
//   ~/.zcode/cli/plugins/cache/goodai-base/goodai-zcode/<version>/
//     .zcode-plugin/plugin.json
//     skills/...   (all goodai-base skills)
//   ~/.zcode/cli/plugins/cache/goodai-base/goodai-zcode/<version>/.zcode-plugin-seed.json
//   ~/.zcode/cli/plugins/marketplaces/goodai-base/marketplace.json   (absolute cachePath)
//
// The plugin bundle must already exist in the repo (run generate-zcode-plugin).
//
// Usage:
//   bun src/sync-zcode.ts
//   bun src/sync-zcode.ts --repo-root <path> --home <path>
//   bun src/sync-zcode.ts --dry-run

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const PLUGIN_NAME = 'goodai-zcode';
const MARKETPLACE_NAME = 'goodai-base';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const repoRoot = getOption('--repo-root') ?? resolve(import.meta.dir, '../..');
const homeDir = getOption('--home') ?? homedir();

const PLUGINS_ROOT = join(homeDir, '.zcode', 'cli', 'plugins');
const CACHE_ROOT = join(PLUGINS_ROOT, 'cache', MARKETPLACE_NAME, PLUGIN_NAME);
const MARKETPLACE_DIR = join(PLUGINS_ROOT, 'marketplaces', MARKETPLACE_NAME);
const MARKETPLACE_FILE = join(MARKETPLACE_DIR, 'marketplace.json');

function getOption(name: string): string | undefined {
  const idx = argv.indexOf(name);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
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

/**
 * Compute the ZCode seed hash. The exact algorithm ZCode uses is not documented,
 * but empirical checks against the official superpowers plugin show the seed
 * `hash` equals the sha256 of the plugin.json file's (resolved) bytes.
 */
function computeSeedHash(pluginJsonPath: string): string {
  const bytes = readFileSync(pluginJsonPath);
  return createHash('sha256').update(bytes).digest('hex');
}

function writeSeed(pluginVersionDir: string, version: string): void {
  const pluginJsonPath = join(pluginVersionDir, '.zcode-plugin', 'plugin.json');
  const seed = {
    hash: computeSeedHash(pluginJsonPath),
    marketplace: MARKETPLACE_NAME,
    plugin: PLUGIN_NAME,
    pluginVersion: version,
    source: 'filesystem',
    version: 1,
  };
  writeJson(join(pluginVersionDir, '.zcode-plugin-seed.json'), seed);
}

function installPlugin(version: string): void {
  const src = join(repoRoot, 'plugins', PLUGIN_NAME);
  if (!existsSync(join(src, '.zcode-plugin', 'plugin.json'))) {
    throw new Error(
      `Plugin bundle not found at ${src}. Run "bun src/generate-zcode-plugin.ts" first.`,
    );
  }

  // Wipe any previous version(s) of this plugin from the cache, then write the
  // current one. ZCode keys the cache on `<marketplace>/<plugin>/<version>`.
  if (existsSync(CACHE_ROOT)) {
    rmSync(CACHE_ROOT, { recursive: true, force: true });
  }

  const dest = join(CACHE_ROOT, version);
  mkdirSync(dest, { recursive: true });

  if (dryRun) {
    console.log(`[dry-run] would copy ${src} -> ${dest}`);
    console.log(`[dry-run] would write seed at ${join(dest, '.zcode-plugin-seed.json')}`);
    return;
  }

  cpSync(src, dest, {
    recursive: true,
    dereference: false,
    filter: (path) => !path.includes('/node_modules/') && !path.includes('/.git/'),
  });
  writeSeed(dest, version);

  const skillCount =
    existsSync(join(dest, 'skills'))
      ? readdirSync(join(dest, 'skills'), { withFileTypes: true })
          .filter((e) => e.isDirectory() && e.name !== 'shared')
          .length
      : 0;
  console.log(`Installed plugin to ${dest} (${skillCount} skills)`);
}

function registerMarketplace(version: string): void {
  const cachePath = join(CACHE_ROOT, version);
  const manifest = {
    name: MARKETPLACE_NAME,
    plugins: [
      {
        cachePath,
        name: PLUGIN_NAME,
        source: 'filesystem',
        version,
      },
    ],
    version: 1,
  };

  if (dryRun) {
    console.log(`[dry-run] would write marketplace at ${MARKETPLACE_FILE}`);
    return;
  }

  // If a marketplace file already exists (e.g. from a previous goodai-base
  // install), keep it minimal and up to date for our single plugin.
  writeJson(MARKETPLACE_FILE, manifest);
  console.log(`Registered marketplace "${MARKETPLACE_NAME}" at ${MARKETPLACE_FILE}`);
}

try {
  const pluginJson = readJson(join(repoRoot, 'plugins', PLUGIN_NAME, '.zcode-plugin', 'plugin.json'));
  const version: string = pluginJson.version;

  if (!version) {
    throw new Error('plugin.json is missing a "version" field.');
  }

  if (dryRun) {
    console.log(`[dry-run] install version ${version} into ${PLUGINS_ROOT}`);
  }

  installPlugin(version);
  registerMarketplace(version);

  if (!dryRun) {
    console.log('');
    console.log('ZCode plugin install complete. Restart ZCode to load the skills.');
  }
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
