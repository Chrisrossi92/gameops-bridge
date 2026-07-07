import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatEasternClockHourFromUtc,
  formatEasternShortTimestamp,
  formatEasternTimestamp,
  OPERATOR_TIME_ZONE_LABEL
} from '../src/time-format.ts';

test('operator time labels use Eastern time with EST and EDT abbreviations', () => {
  assert.equal(OPERATOR_TIME_ZONE_LABEL, 'Eastern');
  assert.match(formatEasternTimestamp('2026-01-07T20:00:00.000Z'), /EST/);
  assert.match(formatEasternTimestamp('2026-07-07T20:00:00.000Z'), /EDT/);
  assert.match(formatEasternShortTimestamp('2026-07-07T20:00:00.000Z'), /EDT/);
});

test('UTC hour buckets render as Eastern clock labels', () => {
  assert.equal(formatEasternClockHourFromUtc(20), '3:00 PM EST');
  assert.doesNotMatch(formatEasternClockHourFromUtc(20), /UTC/);
});

test('invalid timestamp strings stay visible for diagnostics', () => {
  assert.equal(formatEasternTimestamp('not-a-date'), 'not-a-date');
  assert.equal(formatEasternShortTimestamp('not-a-date'), 'not-a-date');
});
