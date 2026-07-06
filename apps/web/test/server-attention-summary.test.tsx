import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServerAttentionSummary } from '../src/server-attention-summary.tsx';

test('server attention summary renders the overview question and quiet healthy state', () => {
  const html = renderToStaticMarkup(
    <ServerAttentionSummary
      gameLabel="Valheim"
      gameSymbol="VH"
      serverName="Northlands"
      status="online"
      statusMessage="Server is online and telemetry is current."
      warningCount={0}
      warnings={[]}
      recommendedAction="No immediate action needed"
      currentActivity="No players are online right now."
      recentChange={null}
      metrics={[
        { label: 'Online now', value: 0 },
        { label: 'Active this week', value: 4 },
        { label: 'Last activity', value: '2h ago' },
        { label: 'Data', value: 'live' }
      ]}
    />
  );

  assert.match(html, /Does this server need my attention/);
  assert.match(html, /No immediate action needed/);
  assert.match(html, /Nothing is asking for review right now/);
  assert.match(html, /No important change is visible yet/);
  assert.doesNotMatch(html, /Connector Status/);
  assert.doesNotMatch(html, /Settings Control Center/);
  assert.doesNotMatch(html, /Telemetry Pipeline/);
});

test('server attention summary renders warning and supported next action', () => {
  const html = renderToStaticMarkup(
    <ServerAttentionSummary
      gameLabel="Palworld"
      gameSymbol="PW"
      serverName="Fantasy Isles"
      status="degraded"
      statusMessage="Guild activity needs review."
      warningCount={2}
      warnings={['One guild risk needs review', 'Base usage is climbing']}
      recommendedAction="Review guild risk"
      currentActivity="3 players are online now."
      recentChange="Base pressure elevated at 71%"
      metrics={[
        { label: 'Online now', value: 3 },
        { label: 'Active this week', value: 11 },
        { label: 'Last activity', value: 'now' },
        { label: 'Data', value: 'live' }
      ]}
    />
  );

  assert.match(html, /This server needs attention/);
  assert.match(html, /One guild risk needs review/);
  assert.match(html, /Base usage is climbing/);
  assert.match(html, /Review guild risk/);
  assert.match(html, /3 players are online now/);
  assert.match(html, /Base pressure elevated at 71%/);
});
