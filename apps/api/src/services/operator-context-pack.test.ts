import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  OperatorBrief,
  OperatorChangesSummary,
  OperatorContext,
  OperatorDailyBrief,
  OperatorInsightsResponse,
  OperatorMemoryIndex,
  OperatorTimelineEvent
} from '@gameops/shared';
import { buildOperatorContextPack } from './operator-context-pack.js';

const generatedAt = '2026-06-29T12:00:00.000Z';

const context: OperatorContext = {
  generatedAt,
  readOnly: true,
  pm2: {
    status: 'available',
    processCount: 1,
    processes: [{
      name: 'gameops-api',
      pid: 123,
      status: 'online',
      restarts: 0,
      uptimeMs: 60_000,
      memoryBytes: 100_000_000,
      cpuPercent: 2
    }]
  },
  system: {
    uptimeSeconds: 1000,
    loadAverage: [0.2, 0.3, 0.4],
    cpuCount: 2,
    memory: {
      totalBytes: 100,
      freeBytes: 50,
      usedBytes: 50,
      usedPercent: 50
    }
  },
  disks: [{
    label: 'root',
    status: 'available',
    sizeBytes: 100,
    usedBytes: 83,
    availableBytes: 17,
    usedPercent: 83
  }],
  logs: [{
    label: 'api',
    status: 'available',
    lines: ['DISCORD_TOKEN=super-secret-token-value raw log line']
  }],
  repos: [{
    label: 'GameOps Bridge',
    status: 'available',
    branch: 'main',
    upstream: 'origin/main',
    isDirty: true,
    ahead: 0,
    behind: 1,
    modifiedCount: 2,
    stagedCount: 0,
    untrackedCount: 1,
    changedFilePaths: ['apps/api/src/index.ts'],
    changes: [' M apps/api/src/index.ts'],
    lastCommit: {
      hash: 'abcdef123456',
      date: generatedAt,
      message: 'Operator context pack'
    },
    recommendations: ['local-changes-review']
  }],
  healthChecks: [],
  collectionWarnings: []
};

const brief: OperatorBrief = {
  generatedAt,
  readOnly: true,
  health: 'warning',
  summary: '1 operator risk detected.',
  risks: ['GameOps Bridge has local changes.'],
  recentEvents: ['Git: GameOps Bridge is dirty on main.'],
  recommendations: ['Review repository state before deploying or pulling updates.']
};

const dailyBrief: OperatorDailyBrief = {
  generatedAt,
  readOnly: true,
  range: {
    from: '2026-06-28T12:00:00.000Z',
    to: generatedAt
  },
  headline: '1 warning signal observed in the last 24 hours.',
  healthSummary: 'Last 24 hours: 1 event, 1 warning, 0 critical across git.',
  keyChanges: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
  warnings: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
  recommendations: ['Review local repository changes before deploy or pull.'],
  confidence: 'medium'
};

const changes: OperatorChangesSummary = {
  generatedAt,
  readOnly: true,
  range: dailyBrief.range,
  headline: '1 active warning changed in the last 24 hours.',
  meaningfulChanges: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
  unchangedSignals: ['Disk has no active warning in the current operator snapshot.'],
  newWarnings: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
  resolvedWarnings: [],
  recommendedNextAction: 'Review local repository changes before deploy or pull.',
  confidence: 'medium'
};

const insights: OperatorInsightsResponse = {
  generatedAt,
  readOnly: true,
  insights: [{
    title: 'I noticed a repo with local changes',
    summary: 'A configured repository appears dirty and should be reviewed before deployment.',
    severity: 'warning',
    confidence: 'medium',
    evidence: ['GameOps Bridge is dirty on main with 2 modified and 1 untracked files.'],
    recommendedAction: 'Review local repository changes before deploy or pull.'
  }]
};

const memoryIndex: OperatorMemoryIndex = {
  generatedAt,
  readOnly: true,
  range: {
    from: generatedAt,
    to: generatedAt
  },
  deployments: {
    count: 1,
    latestOccurrence: generatedAt,
    activeState: 'observed',
    historicalSummary: 'Deployments: 1 event, 0 warnings, 0 critical. Latest: Repository behind upstream.',
    trend: 'recent',
    examples: ['Repository behind upstream: GameOps Bridge is behind origin/main.']
  },
  services: {
    count: 0,
    latestOccurrence: null,
    activeState: 'quiet',
    historicalSummary: 'Services: no timeline events recorded.',
    trend: 'quiet',
    examples: []
  },
  storage: {
    count: 1,
    latestOccurrence: generatedAt,
    activeState: 'attention',
    historicalSummary: 'Storage: 1 event, 1 warning, 0 critical. Latest: Disk usage high.',
    trend: 'recent',
    examples: ['Disk usage high: root disk usage is 83%.']
  },
  git: {
    count: 1,
    latestOccurrence: generatedAt,
    activeState: 'attention',
    historicalSummary: 'Git: 1 event, 1 warning, 0 critical. Latest: Repository has local changes.',
    trend: 'recent',
    examples: ['Repository has local changes: GameOps Bridge is dirty.']
  },
  recommendations: {
    count: 1,
    latestOccurrence: generatedAt,
    activeState: 'attention',
    historicalSummary: 'Recommendations: 1 event, 1 warning, 0 critical. Latest: Operator recommendation generated.',
    trend: 'recent',
    examples: ['Operator recommendation generated: Review repository state.']
  },
  warnings: {
    count: 3,
    latestOccurrence: generatedAt,
    activeState: 'attention',
    historicalSummary: 'Warnings: 3 events, 3 warnings, 0 critical. Latest: Repository has local changes.',
    trend: 'increasing',
    examples: ['Repository has local changes: GameOps Bridge is dirty.']
  },
  health: {
    count: 0,
    latestOccurrence: null,
    activeState: 'quiet',
    historicalSummary: 'Health: no timeline events recorded.',
    trend: 'quiet',
    examples: []
  },
  timelineStatistics: {
    totalEvents: 4,
    warningEvents: 3,
    criticalEvents: 0,
    byType: { deployment: 1, disk: 1, git: 1, operator: 1 },
    bySeverity: { info: 1, warning: 3 },
    firstEventAt: generatedAt,
    lastEventAt: generatedAt,
    historicalSummary: 'Timeline memory has 4 events, 3 warnings, and 0 critical events.',
    trend: 'increasing'
  }
};

function timelineEvent(index: number): OperatorTimelineEvent {
  return {
    id: `event-${index}`,
    type: 'git',
    severity: 'warning',
    occurredAt: generatedAt,
    title: 'Repository has local changes',
    summary: `GameOps Bridge dirty event ${index}`,
    fingerprint: `git:gameops:dirty:${index}`,
    metadata: {}
  };
}

test('context pack includes expected sections', () => {
  const pack = buildOperatorContextPack({
    context,
    brief,
    dailyBrief,
    changes,
    insights,
    memoryIndex,
    timelineEvents: [timelineEvent(1)],
    generatedAt
  });

  assert.equal(pack.readOnly, true);
  assert.equal(pack.redactionApplied, true);
  assert(pack.sections.some((section) => section.title === 'Current operator brief'));
  assert(pack.sections.some((section) => section.title === 'Daily brief'));
  assert(pack.sections.some((section) => section.title === 'What changed'));
  assert(pack.sections.some((section) => section.title === 'Repository state summaries'));
  assert(pack.sections.some((section) => section.title === 'Operational memory index'));
  assert.equal(pack.memoryIndex?.timelineStatistics.totalEvents, 4);
  assert.equal(pack.recentTimeline?.length, 1);
  assert(pack.recommendedFocus.some((focus) => focus.includes('Review')));
});

test('context pack caps timeline events', () => {
  const pack = buildOperatorContextPack({
    context,
    brief,
    dailyBrief,
    changes,
    insights,
    memoryIndex,
    timelineEvents: Array.from({ length: 20 }, (_, index) => timelineEvent(index)),
    generatedAt
  });
  const timelineSection = pack.sections.find((section) => section.title === 'Recent timeline');

  assert.equal(timelineSection?.bullets.length, 8);
  assert.equal(pack.recentTimeline?.length, 12);
  assert(pack.evidence.length <= 40);
});

test('context pack excludes raw logs and secrets', () => {
  const pack = buildOperatorContextPack({
    context,
    brief: {
      ...brief,
      risks: ['DISCORD_TOKEN=super-secret-token-value should be redacted.']
    },
    dailyBrief,
    changes,
    insights,
    memoryIndex,
    timelineEvents: [timelineEvent(1)],
    generatedAt
  });
  const serialized = JSON.stringify(pack);

  assert(!serialized.includes('super-secret-token-value'));
  assert(!serialized.includes('raw log line'));
  assert(serialized.includes('[REDACTED]'));
});

test('context pack handles empty timeline', () => {
  const pack = buildOperatorContextPack({
    context,
    brief,
    dailyBrief,
    changes,
    insights,
    memoryIndex,
    timelineEvents: [],
    generatedAt
  });
  const timelineSection = pack.sections.find((section) => section.title === 'Recent timeline');

  assert.match(timelineSection?.summary ?? '', /0 recent timeline/);
  assert.deepEqual(timelineSection?.bullets, []);
});
