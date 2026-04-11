#!/usr/bin/env bun
// Detect available models across different AI agent environments

import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileExists, readTextFile } from './shared/fs-utils.js';

function detectCodex(): void {
  const cacheFile = join(homedir(), '.codex', 'models_cache.json');
  if (!fileExists(cacheFile)) return;

  console.log('=== Codex Models ===');
  try {
    const raw = readTextFile(cacheFile);
    const data = JSON.parse(raw) as { models: Array<{ visibility: string; display_name: string; description: string }> };
    const listed = data.models.filter((m) => m.visibility === 'list');
    if (listed.length === 0) {
      console.log('  (no models with visibility "list")');
    } else {
      for (const m of listed) {
        console.log(`${m.display_name} - ${m.description}`);
      }
    }
  } catch {
    console.log('  (error reading models)');
  }
}

function detectCursor(): void {
  const configDir = join(homedir(), '.cursor');
  if (!fileExists(configDir)) return;

  console.log('=== Cursor Models ===');
  const settingsFile = join(configDir, 'settings.json');
  if (fileExists(settingsFile)) {
    try {
      const raw = readTextFile(settingsFile);
      const data = JSON.parse(raw) as { model?: string };
      console.log(data.model ?? 'default');
    } catch {
      console.log('  default');
    }
  }
  console.log('  Note: Cursor uses OpenAI models by default');
}

function detectAntigravity(): void {
  const configDir = join(homedir(), '.antigravity');
  if (!fileExists(configDir)) return;

  console.log('=== Antigravity Models ===');
  const configFile = join(configDir, 'config.json');
  if (fileExists(configFile)) {
    try {
      const raw = readTextFile(configFile);
      const data = JSON.parse(raw) as { model?: string };
      console.log(data.model ?? 'default');
    } catch {
      console.log('  default');
    }
  } else {
    console.log('  (no config found)');
  }
}

function detectOpenCode(): void {
  const configDir = join(homedir(), '.config', 'opencode');
  if (!fileExists(configDir)) return;

  console.log('=== OpenCode Models ===');
  const settingsFile = join(configDir, 'settings.json');
  if (fileExists(settingsFile)) {
    try {
      const raw = readTextFile(settingsFile);
      const data = JSON.parse(raw) as { model?: string; provider?: string };
      console.log(data.model ?? data.provider ?? 'default');
    } catch {
      console.log('  default');
    }
  } else {
    console.log('  (check OpenCode documentation)');
  }
}

function detectZed(): void {
  const configDir = join(homedir(), '.config', 'zed');
  if (!fileExists(configDir)) return;

  console.log('=== Zed Models ===');
  const settingsFile = join(configDir, 'settings.json');
  if (fileExists(settingsFile)) {
    try {
      const raw = readTextFile(settingsFile);
      const data = JSON.parse(raw) as { model?: string };
      console.log(data.model ?? 'default');
    } catch {
      console.log('  default');
    }
  } else {
    console.log('  (check Zed settings)');
  }
}

console.log('Detecting available models across environments...');
console.log('');

detectCodex();
console.log('');

detectCursor();
console.log('');

detectAntigravity();
console.log('');

detectOpenCode();
console.log('');

detectZed();
