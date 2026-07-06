import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayersSurfaceSection } from '../src/players-surface-section.tsx';

test('players surface sections render the operator hierarchy in order', () => {
  const html = renderToStaticMarkup(
    <>
      <PlayersSurfaceSection
        eyebrow="Player Activity Summary"
        title="Who is here right now?"
        description="Live activity appears before evidence."
      >
        <button type="button">Open player detail</button>
      </PlayersSurfaceSection>
      <PlayersSurfaceSection
        eyebrow="Player Directory"
        title="Who do we know?"
        description="Known players and profiles."
      >
        <div>Known player row</div>
      </PlayersSurfaceSection>
      <PlayersSurfaceSection
        eyebrow="Game-Specific Context"
        title="Palworld guilds and bases"
        description="Guilds and bases are separate from player activity."
      >
        <div>Guild Review</div>
      </PlayersSurfaceSection>
      <PlayersSurfaceSection
        eyebrow="Supporting Evidence"
        title="Palworld player evidence"
        description="Save identity and confidence details are quiet."
        quiet
      >
        <div>Review Saves</div>
      </PlayersSurfaceSection>
    </>
  );

  const activityIndex = html.indexOf('Player Activity Summary');
  const directoryIndex = html.indexOf('Player Directory');
  const contextIndex = html.indexOf('Game-Specific Context');
  const evidenceIndex = html.indexOf('Supporting Evidence');

  assert.ok(activityIndex >= 0);
  assert.ok(directoryIndex > activityIndex);
  assert.ok(contextIndex > directoryIndex);
  assert.ok(evidenceIndex > contextIndex);
  assert.match(html, /Open player detail/);
  assert.match(html, /Guild Review/);
  assert.match(html, /Review Saves/);
});

test('players surface section can visually quiet supporting evidence', () => {
  const html = renderToStaticMarkup(
    <PlayersSurfaceSection
      eyebrow="Supporting Evidence"
      title="Valheim player evidence"
      description="Session and relationship details."
      quiet
    >
      <div>Character Evidence</div>
    </PlayersSurfaceSection>
  );

  assert.match(html, /players-surface-section-quiet/);
  assert.match(html, /Valheim player evidence/);
  assert.match(html, /Character Evidence/);
});
