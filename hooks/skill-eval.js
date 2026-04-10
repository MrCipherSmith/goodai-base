'use strict';

/**
 * Skill Evaluation Hook — Auto Skill Selection System
 * Registered as UserPromptSubmit hook in ~/.claude/settings.json
 *
 * Reads skill-registry.json, scores the incoming prompt against trigger patterns,
 * and injects ranked skill suggestions into Claude's context.
 *
 * Scoring:
 *   keyword match  → +2 pts each
 *   regex match    → +2 pts each
 *   path match     → +5 pts each
 *
 * Output: JSON to stdout consumed by Claude Code hook system
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const REGISTRY_PATH = path.join(__dirname, 'skill-registry.json');
const LOG_DIR = path.join(os.homedir(), '.claude', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'skill-eval.log');
const LOG_MAX_BYTES = 500 * 1024; // 500KB

// ---------------------------------------------------------------------------
// Pure scoring function — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Score a single skill entry against a prompt.
 * @param {string} prompt  Lowercased prompt text
 * @param {Object} skill   Skill entry from registry
 * @param {boolean} wholeWordMatch  If true, wrap keywords in word-boundary regex
 * @returns {{ score: number, reasons: string[] }}
 */
function scoreSkill(prompt, skill, wholeWordMatch) {
  let score = 0;
  const reasons = [];

  // Keyword matching (+2 each)
  const keywords = skill.keywords || [];
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (wholeWordMatch) {
      const re = new RegExp('\\b' + kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (re.test(prompt)) {
        score += 2;
        reasons.push(`keyword "${kw}"`);
      }
    } else {
      if (prompt.includes(kwLower)) {
        score += 2;
        reasons.push(`keyword "${kw}"`);
      }
    }
  }

  // Regex pattern matching (+2 each)
  const patterns = skill.patterns || [];
  for (const pat of patterns) {
    try {
      const re = new RegExp(pat, 'i');
      if (re.test(prompt)) {
        score += 2;
        reasons.push(`pattern /${pat}/`);
      }
    } catch (_) {
      // Invalid regex — skip silently
    }
  }

  // File path matching (+5 each)
  const paths = skill.paths || [];
  // Extract file-like tokens from prompt by splitting on whitespace first,
  // then keeping tokens that contain a dot (avoids catastrophic backtracking).
  const fileTokens = prompt.split(/\s+/).filter((t) => t.includes('.'));
  for (const pathPattern of paths) {
    const patLower = pathPattern.toLowerCase();
    for (const token of fileTokens) {
      if (token.includes(patLower) || token.endsWith(patLower.replace('*', ''))) {
        score += 5;
        reasons.push(`path "${token}" matches "${pathPattern}"`);
        break; // Count path pattern once per skill
      }
    }
  }

  return { score, reasons };
}

/**
 * Score a prompt against the full registry and return ranked suggestions.
 * Pure function — no I/O, no side effects.
 *
 * @param {string} rawPrompt  Original prompt text
 * @param {Object} registry   Parsed skill-registry.json
 * @returns {{ skillSuggestions: Array, prefix: string }}
 */
function scorePrompt(rawPrompt, registry) {
  if (!rawPrompt || rawPrompt.trim().length < 5) {
    return { skillSuggestions: [], prefix: '' };
  }

  const config = registry.hookConfig || {};
  if (config.enabled === false) {
    return { skillSuggestions: [], prefix: '' };
  }

  const globalMinScore = config.globalMinScore != null ? config.globalMinScore : 4;
  const maxSuggestions = config.maxSuggestions != null ? config.maxSuggestions : 3;
  const wholeWordMatch = config.wholeWordMatch === true;

  const prompt = rawPrompt.toLowerCase();
  const skills = registry.skills || [];

  // Score all skills
  const scored = skills.map((skill) => {
    const minScore = skill.minScore != null ? skill.minScore : globalMinScore;
    const { score, reasons } = scoreSkill(prompt, skill, wholeWordMatch);
    return { skill, score, reasons, minScore };
  });

  // Filter by threshold, sort by score desc (path-boosted skills rank higher naturally)
  const passing = scored
    .filter((s) => s.score >= s.minScore && s.score >= globalMinScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break: path matches boost rank (already counted in score, but explicit)
      const aHasPath = (a.skill.paths || []).length > 0 ? 1 : 0;
      const bHasPath = (b.skill.paths || []).length > 0 ? 1 : 0;
      return bHasPath - aHasPath;
    })
    .slice(0, maxSuggestions);

  if (passing.length === 0) {
    return { skillSuggestions: [], prefix: '' };
  }

  const skillSuggestions = passing.map((s) => {
    const confidence =
      s.score >= 8 ? 'high' : s.score >= 5 ? 'medium' : 'low';
    return {
      skill: s.skill.name,
      description: s.skill.description || '',
      score: s.score,
      confidence,
      reason: s.reasons.join(', '),
    };
  });

  // Build human-readable prefix for Claude's context
  const lines = ['[Skill Evaluator] Suggested skill(s) based on prompt analysis:'];
  skillSuggestions.forEach((s, i) => {
    lines.push(
      `${i + 1}. ${s.skill} (${s.confidence.toUpperCase()}, score=${s.score}) — matched: ${s.reason}`
    );
  });
  lines.push(
    'To activate a skill, invoke it by name. These suggestions are advisory — AGENTS.md routing remains authoritative.'
  );
  const prefix = lines.join('\n');

  return { skillSuggestions, prefix };
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function appendLog(message) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    // Rotate if over limit
    if (fs.existsSync(LOG_FILE)) {
      const stat = fs.statSync(LOG_FILE);
      if (stat.size > LOG_MAX_BYTES) {
        fs.writeFileSync(LOG_FILE, ''); // Truncate
      }
    }
    fs.appendFileSync(LOG_FILE, message + '\n');
  } catch (_) {
    // Log failure must never propagate
  }
}

// ---------------------------------------------------------------------------
// Main — hook entrypoint
// ---------------------------------------------------------------------------

function main() {
  const startMs = Date.now();
  let inputData = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    inputData += chunk;
  });

  process.stdin.on('end', () => {
    try {
      // Parse hook payload — Claude Code sends JSON via stdin
      let prompt = '';
      try {
        const payload = JSON.parse(inputData);
        // Claude Code UserPromptSubmit hook payload shape:
        // { prompt: string } or { message: string } or raw string
        prompt =
          payload.prompt ||
          payload.message ||
          (typeof payload === 'string' ? payload : inputData);
      } catch (_) {
        // Fallback: treat stdin as raw prompt text
        prompt = inputData;
      }

      // Load registry
      let registry;
      try {
        const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
        registry = JSON.parse(raw);
      } catch (err) {
        appendLog(
          `${new Date().toISOString()} | ERROR loading registry: ${err.message}`
        );
        process.stdout.write(JSON.stringify({ skillSuggestions: [] }));
        return;
      }

      const { skillSuggestions, prefix } = scorePrompt(prompt, registry);

      const elapsed = Date.now() - startMs;
      const topSkill =
        skillSuggestions.length > 0
          ? `${skillSuggestions[0].skill}(score=${skillSuggestions[0].score})`
          : 'none';
      appendLog(
        `${new Date().toISOString()} | len=${prompt.length} | top=${topSkill} | count=${skillSuggestions.length} | ${elapsed}ms`
      );

      const output = { skillSuggestions };
      if (prefix) {
        output.context = prefix;
      }

      process.stdout.write(JSON.stringify(output));
    } catch (err) {
      appendLog(`${new Date().toISOString()} | FATAL: ${err.message}`);
      process.stdout.write(JSON.stringify({ skillSuggestions: [] }));
    }
  });
}

// Export for unit testing
module.exports = { scorePrompt, scoreSkill };

// Run if executed directly
if (require.main === module) {
  main();
}
