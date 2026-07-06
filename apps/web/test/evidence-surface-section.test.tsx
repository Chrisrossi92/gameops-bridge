import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EvidenceSurfaceSection, EvidenceSummaryCard } from '../src/evidence-surface-section.tsx';

test('history evidence surface renders timeline summary before exploration and supporting evidence', () => {
  const html = renderToStaticMarkup(
    <>
      <EvidenceSurfaceSection
        eyebrow="Operator Timeline Summary"
        title="What happened?"
        description="History starts with meaningful change."
      >
        <EvidenceSummaryCard
          eyebrow="Timeline read"
          question="What happened?"
          statusLabel="trusted history"
          statusTone="high"
          summary="Recent world events are available."
          details={[
            'A player joined the world.',
            '2 trusted events available.',
            '5 chronicle entries available for exploration.'
          ]}
          metrics={[
            { label: 'Trusted events', value: 2 },
            { label: 'Chronicle entries', value: 5 }
          ]}
        />
      </EvidenceSurfaceSection>
      <EvidenceSurfaceSection
        eyebrow="Search / Exploration"
        title="Explore world memory"
        description="Search and chronicle tools remain reachable."
      >
        <div>World Memory Search</div>
        <div>Realm Chronicle</div>
      </EvidenceSurfaceSection>
      <EvidenceSurfaceSection
        eyebrow="Supporting Evidence"
        title="Trusted event evidence"
        description="Raw timeline evidence remains available."
        quiet
      >
        <div>World History</div>
      </EvidenceSurfaceSection>
    </>
  );

  const summaryIndex = html.indexOf('Operator Timeline Summary');
  const explorationIndex = html.indexOf('Search / Exploration');
  const evidenceIndex = html.indexOf('Supporting Evidence');

  assert.ok(summaryIndex >= 0);
  assert.ok(explorationIndex > summaryIndex);
  assert.ok(evidenceIndex > explorationIndex);
  assert.match(html, /What happened\?/);
  assert.match(html, /World Memory Search/);
  assert.match(html, /World History/);
});

test('capabilities evidence surface renders coverage before capability areas and diagnostics', () => {
  const html = renderToStaticMarkup(
    <>
      <EvidenceSurfaceSection
        eyebrow="Console Coverage Summary"
        title="What can this console know or do?"
        description="Coverage and limits appear first."
      >
        <EvidenceSummaryCard
          eyebrow="Coverage read"
          question="What can this console know or do?"
          statusLabel="running"
          statusTone="high"
          summary="Connector data is available."
          details={[
            'Telemetry is available.',
            'This server has a configured connector profile.',
            'Continue observing current data freshness.'
          ]}
          metrics={[
            { label: 'Data freshness', value: 'live' },
            { label: 'Telemetry', value: 'available' }
          ]}
        />
      </EvidenceSurfaceSection>
      <EvidenceSurfaceSection
        eyebrow="Available Capability Areas"
        title="Operator workspace"
        description="Existing capability surfaces remain reachable."
      >
        <div>Capability Areas</div>
        <div>Settings Control Center</div>
      </EvidenceSurfaceSection>
      <EvidenceSurfaceSection
        eyebrow="Technical Evidence / Diagnostics"
        title="Connector and data confidence"
        description="Diagnostics support the coverage read."
        quiet
      >
        <div>Connector Status</div>
      </EvidenceSurfaceSection>
    </>
  );

  const summaryIndex = html.indexOf('Console Coverage Summary');
  const capabilityIndex = html.indexOf('Available Capability Areas');
  const diagnosticsIndex = html.indexOf('Technical Evidence / Diagnostics');

  assert.ok(summaryIndex >= 0);
  assert.ok(capabilityIndex > summaryIndex);
  assert.ok(diagnosticsIndex > capabilityIndex);
  assert.match(html, /What can this console know or do\?/);
  assert.match(html, /Capability Areas/);
  assert.match(html, /Connector Status/);
  assert.doesNotMatch(html, /Start server/);
  assert.doesNotMatch(html, /Stop server/);
  assert.doesNotMatch(html, /Restart server/);
  assert.doesNotMatch(html, /Deploy now/);
});

test('evidence surface section can visually quiet technical support panels', () => {
  const html = renderToStaticMarkup(
    <EvidenceSurfaceSection
      eyebrow="Technical Evidence / Diagnostics"
      title="Palworld technical evidence"
      description="Low-priority diagnostic detail."
      quiet
    >
      <div>Identity Review Failures</div>
    </EvidenceSurfaceSection>
  );

  assert.match(html, /evidence-surface-section-quiet/);
  assert.match(html, /Palworld technical evidence/);
  assert.match(html, /Identity Review Failures/);
});
