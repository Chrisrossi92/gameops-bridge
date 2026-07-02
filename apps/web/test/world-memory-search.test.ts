import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorldMemoryRegistry, searchWorldMemoryRecords, type WorldMemoryRecord } from '../src/world-memory.ts';

function record(overrides: Partial<WorldMemoryRecord>): WorldMemoryRecord {
  return {
    id: overrides.id ?? 'record',
    serverId: overrides.serverId ?? 'server',
    displayName: overrides.displayName ?? 'Memory',
    type: overrides.type ?? 'character',
    game: overrides.game ?? 'valheim',
    firstSeenAt: overrides.firstSeenAt ?? '2026-07-01T10:00:00.000Z',
    lastSeenAt: overrides.lastSeenAt ?? '2026-07-01T12:00:00.000Z',
    currentStatus: overrides.currentStatus ?? 'active',
    confidence: overrides.confidence ?? 'high',
    chronicleReferences: overrides.chronicleReferences ?? [],
    relationships: overrides.relationships ?? [],
    sourceLabel: overrides.sourceLabel ?? 'Test memory',
    metadata: overrides.metadata ?? {}
  };
}

test('world memory search is scoped to the selected game', () => {
  const records = [
    record({ id: 'valheim:dedek', displayName: 'Dědek Vikingson', type: 'character', game: 'valheim' }),
    record({ id: 'palworld:dedek', displayName: 'Dědek Guild', type: 'guild', game: 'palworld' })
  ];

  const valheimResults = searchWorldMemoryRecords(records, 'dědek', 'valheim');
  const palworldResults = searchWorldMemoryRecords(records, 'dědek', 'palworld');

  assert.deepEqual(valheimResults.map((result) => result.id), ['valheim:dedek']);
  assert.deepEqual(palworldResults.map((result) => result.id), ['palworld:dedek']);
});

test('world memory search supports case-insensitive name and type matching', () => {
  const records = [
    record({ id: 'palworld:guild', displayName: 'Iron Wolves', type: 'guild', game: 'palworld' }),
    record({ id: 'palworld:player', displayName: 'CDAWG9000', type: 'person', game: 'palworld', sourceLabel: 'Guild member activity' })
  ];

  assert.deepEqual(searchWorldMemoryRecords(records, 'iron', 'palworld').map((result) => result.id), ['palworld:guild']);
  assert.deepEqual(searchWorldMemoryRecords(records, 'GUILD', 'palworld').map((result) => result.id), ['palworld:guild', 'palworld:player']);
});

test('world memory search returns no results for an empty query', () => {
  assert.deepEqual(searchWorldMemoryRecords([record({ displayName: 'Any Memory' })], '   ', 'valheim'), []);
});

test('world memory registry exposes guild member relationships', () => {
  const registry = createWorldMemoryRegistry({
    serverId: 'palworld',
    palworld: {
      serverId: 'palworld',
      guildActivity: [{
        guildName: 'Iron Wolves',
        memberCount: 2,
        lastMemberSeenAt: '2026-07-01T12:00:00.000Z',
        lastSeenMemberName: 'Mira',
        riskLevel: 'active',
        daysInactive: 0,
        daysUntilPalboxRisk: 30,
        members: [{
          memberName: 'Mira',
          matched: true,
          matchedPlayerName: 'Mira',
          lastSeenAt: '2026-07-01T12:00:00.000Z',
          daysSinceSeen: 0,
          level: 42,
          saveLinked: true
        }, {
          memberName: 'Sol',
          matched: false,
          matchedPlayerName: null,
          lastSeenAt: null,
          daysSinceSeen: null,
          level: null,
          saveLinked: null
        }]
      }]
    }
  });

  const guild = registry.getRecordsByType('guild').find((memory) => memory.displayName === 'Iron Wolves');
  assert.ok(guild);

  const detail = registry.getDetail(guild.id);
  assert.ok(detail);
  assert.equal(detail.relationships.some((relationship) => relationship.type === 'guild_member'), true);

  const member = registry.getRecordsByType('person').find((memory) => memory.displayName === 'Mira');
  assert.ok(member);
  assert.equal(member.metadata.guildName, 'Iron Wolves');
});
