import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperatorTimelineEvent } from '@gameops/shared';
import { buildOperatorDailyBrief } from './operator-daily-brief.js';

const now = new Date('2026-06-29T12:00:00.000Z');

function event(input: Partial<OperatorTimelineEvent> & Pick<OperatorTimelineEvent, 'type' | 'title' | 'summary' | 'fingerprint'>): OperatorTimelineEvent {
  return {
    id: input.id ?? input.fingerprint,
    severity: input.severity ?? 'warning',
    occurredAt: input.occurredAt ?? '2026-06-29T11:00:00.000Z',
    metadata: input.metadata ?? {},
    ...input
  };
}

test('daily brief handles no timeline events', () => {
  const brief = buildOperatorDailyBrief({ events: [], now });

  assert.equal(brief.confidence, 'low');
  assert.match(brief.headline, /No operator timeline events/);
  assert.deepEqual(brief.warnings, []);
  assert.deepEqual(brief.recommendations, ['Let the timeline collect more read-only observations.']);
});

test('daily brief summarizes git dirty events', () => {
  const brief = buildOperatorDailyBrief({
    now,
    events: [
      event({
        type: 'git',
        title: 'Repository has local changes',
        summary: 'GameOps Bridge is dirty on main with 2 modified and 1 untracked files.',
        fingerprint: 'git:gameops:dirty'
      })
    ]
  });

  assert.equal(brief.confidence, 'medium');
  assert(brief.keyChanges.some((change) => change.includes('dirty on main')));
  assert(brief.warnings.some((warning) => warning.includes('dirty on main')));
  assert(brief.recommendations.includes('Review local repository changes before deploy or pull.'));
});

test('daily brief summarizes disk warning events', () => {
  const brief = buildOperatorDailyBrief({
    now,
    events: [
      event({
        type: 'disk',
        title: 'Disk usage high',
        summary: 'root disk usage is 93%.',
        fingerprint: 'disk:root:high'
      })
    ]
  });

  assert.match(brief.headline, /warning signal/);
  assert(brief.keyChanges.some((change) => change.includes('root disk usage')));
  assert(brief.recommendations.includes('Review disk usage and safe cleanup options on the VPS.'));
});

test('daily brief summarizes PM2 service events', () => {
  const brief = buildOperatorDailyBrief({
    now,
    events: [
      event({
        type: 'pm2',
        title: 'PM2 process state changed',
        summary: 'gameops-api is stopped in PM2.',
        fingerprint: 'pm2:process:gameops-api:stopped'
      })
    ]
  });

  assert(brief.warnings.some((warning) => warning.includes('gameops-api is stopped')));
  assert(brief.recommendations.includes('Review PM2 service state from the VPS before manual action.'));
});

test('daily brief summarizes mixed timeline events with high confidence', () => {
  const brief = buildOperatorDailyBrief({
    now,
    events: [
      event({
        type: 'git',
        title: 'Repository has local changes',
        summary: 'GameOps Bridge is dirty on main with 2 modified and 1 untracked files.',
        fingerprint: 'git:gameops:dirty'
      }),
      event({
        type: 'disk',
        title: 'Disk usage high',
        summary: 'root disk usage is 93%.',
        fingerprint: 'disk:root:high'
      }),
      event({
        type: 'pm2',
        title: 'PM2 process state changed',
        summary: 'gameops-api is stopped in PM2.',
        fingerprint: 'pm2:process:gameops-api:stopped'
      }),
      event({
        type: 'operator',
        title: 'Operator recommendation generated',
        summary: 'Pull only after local repo changes are reviewed.',
        fingerprint: 'operator:recommendation:pull'
      })
    ]
  });

  assert.equal(brief.confidence, 'high');
  assert.match(brief.healthSummary, /4 events/);
  assert(brief.keyChanges.length <= 5);
  assert(brief.warnings.length >= 3);
  assert(brief.recommendations.some((recommendation) => recommendation.includes('Review local repository changes')));
});

test('daily brief ignores events outside the range and redacts secret-like text', () => {
  const brief = buildOperatorDailyBrief({
    now,
    events: [
      event({
        type: 'operator',
        title: 'Old event',
        summary: 'Old event should not be included.',
        fingerprint: 'operator:old',
        occurredAt: '2026-06-27T12:00:00.000Z'
      }),
      event({
        type: 'operator',
        title: 'Operator recommendation generated',
        summary: 'Review DISCORD_TOKEN=super-secret-token-value before action.',
        fingerprint: 'operator:secret'
      })
    ]
  });
  const serialized = JSON.stringify(brief);

  assert(!serialized.includes('Old event should not be included'));
  assert(!serialized.includes('super-secret-token-value'));
  assert(serialized.includes('[REDACTED]'));
});

