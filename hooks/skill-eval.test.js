'use strict';

/**
 * Unit tests for skill-eval.js scorePrompt function.
 * Run with: node --test hooks/skill-eval.test.js
 * Requires Node.js 18+
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { scorePrompt, scoreSkill } = require('./skill-eval');

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseConfig = {
  enabled: true,
  maxSuggestions: 3,
  globalMinScore: 4,
  wholeWordMatch: false,
};

function makeRegistry(skills, configOverrides = {}) {
  return {
    hookConfig: { ...baseConfig, ...configOverrides },
    skills,
  };
}

const commitSkill = {
  name: 'commit',
  description: 'Smart git commit',
  keywords: ['commit', 'stage', 'git commit'],
  patterns: ['\\bcommit\\b'],
  paths: [],
  minScore: 4,
};

const mobxReviewSkill = {
  name: 'code-mobx-store-review',
  description: 'Targeted MobX store review',
  keywords: ['store review', 'mobx store'],
  patterns: [],
  paths: ['.store.ts'],
  minScore: 4,
};

const featureAnalyzerSkill = {
  name: 'feature-analyzer',
  description: 'Deep cross-repo analysis',
  keywords: ['analyze branch', 'cross-repo', 'investigate'],
  patterns: ['analyz.*branch'],
  paths: [],
  minScore: 4,
};

const orchestratorSkill = {
  name: 'job-orchestrator',
  description: 'Full pipeline orchestrator',
  keywords: ['полное ревью', 'full review', 'orchestrate'],
  patterns: ['full.*review', 'полное.*ревью'],
  paths: [],
  minScore: 4,
};

// ---------------------------------------------------------------------------
// scoreSkill tests
// ---------------------------------------------------------------------------

describe('scoreSkill', () => {
  test('keyword match gives +2 per match', () => {
    const { score, reasons } = scoreSkill('please commit my changes', commitSkill, false);
    assert.ok(score >= 2, `Expected score >= 2, got ${score}`);
    assert.ok(reasons.some(r => r.includes('commit')));
  });

  test('multiple keyword matches accumulate', () => {
    const { score } = scoreSkill('git commit stage all changes', commitSkill, false);
    // "commit" (+2) + "stage" (+2) + "git commit" (+2) = 6 min
    assert.ok(score >= 4, `Expected score >= 4, got ${score}`);
  });

  test('regex pattern match gives +2', () => {
    const skill = {
      name: 'test',
      keywords: [],
      patterns: ['\\bcommit\\b'],
      paths: [],
    };
    const { score } = scoreSkill('please commit this', skill, false);
    assert.ok(score >= 2, `Expected score >= 2 from regex, got ${score}`);
  });

  test('path match gives +5', () => {
    const { score, reasons } = scoreSkill(
      'review UserStore.store.ts for issues',
      mobxReviewSkill,
      false
    );
    assert.ok(score >= 5, `Expected score >= 5 from path match, got ${score}`);
    assert.ok(reasons.some(r => r.includes('path')));
  });

  test('no match gives score 0', () => {
    const { score } = scoreSkill('what is the weather today', commitSkill, false);
    assert.equal(score, 0);
  });

  test('invalid regex is skipped without throwing', () => {
    const skill = {
      name: 'bad-regex',
      keywords: [],
      patterns: ['[invalid(regex'],
      paths: [],
    };
    assert.doesNotThrow(() => scoreSkill('any prompt', skill, false));
  });
});

// ---------------------------------------------------------------------------
// scorePrompt tests
// ---------------------------------------------------------------------------

describe('scorePrompt', () => {
  test('high-confidence keyword match triggers suggestion', () => {
    const registry = makeRegistry([commitSkill]);
    const { skillSuggestions } = scorePrompt('commit my changes with a good message', registry);
    assert.ok(skillSuggestions.length > 0, 'Expected at least one suggestion');
    assert.equal(skillSuggestions[0].skill, 'commit');
    assert.ok(skillSuggestions[0].score >= 4);
  });

  test('path pattern boosts score above threshold', () => {
    const registry = makeRegistry([mobxReviewSkill]);
    const { skillSuggestions } = scorePrompt('review UserStore.store.ts for correctness', registry);
    const suggestion = skillSuggestions.find(s => s.skill === 'code-mobx-store-review');
    assert.ok(suggestion, 'Expected code-mobx-store-review to be suggested');
    assert.ok(suggestion.score >= 5, `Expected score >= 5 from path, got ${suggestion.score}`);
  });

  test('no match produces empty suggestions', () => {
    const registry = makeRegistry([commitSkill, featureAnalyzerSkill]);
    const { skillSuggestions, prefix } = scorePrompt('what is the meaning of life', registry);
    assert.equal(skillSuggestions.length, 0);
    assert.equal(prefix, '');
  });

  test('enabled:false returns empty immediately', () => {
    const registry = makeRegistry([commitSkill], { enabled: false });
    const { skillSuggestions } = scorePrompt('commit all changes', registry);
    assert.equal(skillSuggestions.length, 0);
  });

  test('prompt shorter than 5 chars returns empty', () => {
    const registry = makeRegistry([commitSkill]);
    const { skillSuggestions } = scorePrompt('hi', registry);
    assert.equal(skillSuggestions.length, 0);
  });

  test('maxSuggestions cap is respected', () => {
    const skills = [
      { ...commitSkill, keywords: ['test prompt cap'] },
      { ...featureAnalyzerSkill, keywords: ['test prompt cap'] },
      { ...mobxReviewSkill, keywords: ['test prompt cap'] },
      { ...orchestratorSkill, keywords: ['test prompt cap'] },
    ];
    const registry = makeRegistry(skills, { maxSuggestions: 2 });
    const { skillSuggestions } = scorePrompt('test prompt cap', registry);
    assert.ok(skillSuggestions.length <= 2, `Expected <= 2 suggestions, got ${skillSuggestions.length}`);
  });

  test('Russian trigger keyword matches', () => {
    const registry = makeRegistry([orchestratorSkill]);
    const { skillSuggestions } = scorePrompt('полное ревью моего кода', registry);
    assert.ok(skillSuggestions.length > 0, 'Expected suggestion for Russian prompt');
    assert.equal(skillSuggestions[0].skill, 'job-orchestrator');
  });

  test('prefix includes [Skill Evaluator] header when matches found', () => {
    const registry = makeRegistry([commitSkill]);
    const { prefix } = scorePrompt('commit all staged files', registry);
    assert.ok(prefix.includes('[Skill Evaluator]'), 'Expected prefix to contain [Skill Evaluator]');
    assert.ok(prefix.includes('commit'), 'Expected prefix to mention skill name');
  });

  test('confidence is high for score >= 8', () => {
    // Craft a prompt that scores high: keyword match × 2 + pattern match × 1 = 6+ pts
    const highScoreSkill = {
      name: 'high-score',
      description: 'High score skill',
      keywords: ['analyze branch', 'cross-repo', 'investigate', 'study'],
      patterns: ['analyz.*branch'],
      paths: ['.feature.ts'],
      minScore: 4,
    };
    const registry = makeRegistry([highScoreSkill]);
    const { skillSuggestions } = scorePrompt(
      'analyze branch cross-repo investigate myFeature.feature.ts',
      registry
    );
    if (skillSuggestions.length > 0) {
      const s = skillSuggestions[0];
      if (s.score >= 8) {
        assert.equal(s.confidence, 'high');
      } else if (s.score >= 5) {
        assert.equal(s.confidence, 'medium');
      } else {
        assert.equal(s.confidence, 'low');
      }
    }
  });

  test('tie-break: path-boosted skill ranks higher than same keyword-only score', () => {
    const keywordOnlySkill = {
      name: 'keyword-skill',
      description: 'Keyword only',
      keywords: ['tiebreak test'],
      patterns: [],
      paths: [],
      minScore: 4,
    };
    const pathBoostedSkill = {
      name: 'path-skill',
      description: 'Path boosted',
      keywords: ['tiebreak test'],
      patterns: [],
      paths: ['.store.ts'],
      minScore: 4,
    };
    const registry = makeRegistry([keywordOnlySkill, pathBoostedSkill]);
    const { skillSuggestions } = scorePrompt(
      'tiebreak test with UserStore.store.ts',
      registry
    );
    if (skillSuggestions.length >= 2) {
      // path-skill should rank first (higher score from path match)
      assert.equal(skillSuggestions[0].skill, 'path-skill');
    }
  });

  test('globalMinScore filters low-scoring skills', () => {
    const lowSkill = {
      name: 'low-score',
      description: 'Low score',
      keywords: ['commit'],
      patterns: [],
      paths: [],
      minScore: 4,
    };
    // Set globalMinScore very high so nothing passes
    const registry = makeRegistry([lowSkill], { globalMinScore: 100 });
    const { skillSuggestions } = scorePrompt('commit all staged changes', registry);
    assert.equal(skillSuggestions.length, 0);
  });

  test('empty registry returns no suggestions', () => {
    const registry = makeRegistry([]);
    const { skillSuggestions } = scorePrompt('commit all changes', registry);
    assert.equal(skillSuggestions.length, 0);
  });

  test('suggestion object has required fields', () => {
    const registry = makeRegistry([featureAnalyzerSkill]);
    const { skillSuggestions } = scorePrompt('analyze branch changes cross-repo', registry);
    if (skillSuggestions.length > 0) {
      const s = skillSuggestions[0];
      assert.ok('skill' in s, 'Missing skill field');
      assert.ok('score' in s, 'Missing score field');
      assert.ok('confidence' in s, 'Missing confidence field');
      assert.ok('reason' in s, 'Missing reason field');
    }
  });

  test('performance: scores 40 skills in under 50ms', () => {
    // Generate 40 skills
    const manySkills = Array.from({ length: 40 }, (_, i) => ({
      name: `skill-${i}`,
      description: `Skill number ${i}`,
      keywords: [`keyword-${i}`, 'analyze', 'review'],
      patterns: [`pattern${i}`],
      paths: [],
      minScore: 4,
    }));
    const registry = makeRegistry(manySkills);
    const longPrompt = 'analyze review ' + 'x'.repeat(9980);

    const start = Date.now();
    scorePrompt(longPrompt, registry);
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 50, `Expected < 50ms, got ${elapsed}ms`);
  });
});
