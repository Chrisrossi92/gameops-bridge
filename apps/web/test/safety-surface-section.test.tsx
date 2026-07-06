import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SafetySurfaceSection, SafetySummaryCard } from '../src/safety-surface-section.tsx';

test('settings safety surface renders summary before configuration evidence', () => {
  const html = renderToStaticMarkup(
    <>
      <SafetySurfaceSection
        eyebrow="Change Impact Summary"
        title="What happens if I change this?"
        description="Settings starts with safety posture."
      >
        <SafetySummaryCard
          eyebrow="Settings safety"
          question="What happens if I change this?"
          statusLabel="Read-only"
          statusTone="high"
          summary="Readable settings are available."
          details={['No apply, write, restart, or schedule controls are exposed here.']}
          metrics={[
            { label: 'Readable settings', value: 12 },
            { label: 'Read path', value: 'yes' }
          ]}
        />
      </SafetySurfaceSection>
      <SafetySurfaceSection
        eyebrow="Active Configuration"
        title="Current setting controls"
        description="Existing controls remain reachable."
      >
        <button type="button">Review dashboard draft</button>
      </SafetySurfaceSection>
      <SafetySurfaceSection
        eyebrow="Configuration Evidence"
        title="Why does GameOps believe this?"
        description="Diagnostics are quiet."
        quiet
      >
        <div>Settings Control Center</div>
      </SafetySurfaceSection>
    </>
  );

  assert.ok(html.indexOf('What happens if I change this?') < html.indexOf('Configuration Evidence'));
  assert.ok(html.indexOf('Current setting controls') < html.indexOf('Settings Control Center'));
  assert.match(html, /Review dashboard draft/);
  assert.match(html, /No apply, write, restart, or schedule controls are exposed here/);
});

test('backups safety surface renders recovery summary before evidence', () => {
  const html = renderToStaticMarkup(
    <>
      <SafetySurfaceSection
        eyebrow="Recovery Readiness Summary"
        title="Can I safely recover?"
        description="Backups starts with recovery confidence."
      >
        <SafetySummaryCard
          eyebrow="Recovery safety"
          question="Can I safely recover?"
          statusLabel="Unknown"
          statusTone="low"
          summary="No backup readiness details are available."
          details={['Existing recovery evidence will appear when the data source provides it.']}
          metrics={[
            { label: 'Readiness', value: 'unknown' },
            { label: 'Files to back up', value: 0 }
          ]}
        />
      </SafetySurfaceSection>
      <SafetySurfaceSection
        eyebrow="Backup History / Evidence"
        title="Recovery evidence"
        description="Backup diagnostics remain available."
        quiet
      >
        <div>Backup &amp; Rollback Readiness</div>
      </SafetySurfaceSection>
    </>
  );

  assert.ok(html.indexOf('Can I safely recover?') < html.indexOf('Backup History / Evidence'));
  assert.match(html, /Recovery evidence/);
  assert.match(html, /Backup &amp; Rollback Readiness/);
  assert.doesNotMatch(html, /Restore backup/);
  assert.doesNotMatch(html, /Apply settings/);
});
