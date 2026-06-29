import {
  operatorContextPackResponseSchema,
  type OperatorBrief,
  type OperatorChangesSummary,
  type OperatorContext,
  type OperatorContextPackEvidence,
  type OperatorContextPackResponse,
  type OperatorContextPackSection,
  type OperatorDailyBrief,
  type OperatorInsightsResponse,
  type OperatorTimelineEvent
} from '@gameops/shared';
import { redactSecrets } from './operator-redaction.js';

const MAX_TIMELINE_EVENTS = 12;
const MAX_REPOS = 8;
const MAX_EVIDENCE = 40;

function clean(value: string, maxLength = 260): string {
  const cleaned = redactSecrets(value).replace(/\s+/g, ' ').trim();
  return (cleaned || 'No detail available.').slice(0, maxLength);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => clean(value)).filter(Boolean)));
}

function section(title: string, summary: string, bullets: string[]): OperatorContextPackSection {
  return {
    title: clean(title, 90),
    summary: clean(summary),
    bullets: unique(bullets).slice(0, 8)
  };
}

function evidence(source: string, detail: string): OperatorContextPackEvidence {
  return {
    source: clean(source, 90),
    detail: clean(detail)
  };
}

function repoSummary(context: OperatorContext): string[] {
  return context.repos.slice(0, MAX_REPOS).map((repo) => {
    if (repo.status !== 'available') {
      return `${repo.label}: ${repo.status}${repo.message ? ` (${repo.message})` : ''}`;
    }

    const changeSummary = repo.isDirty
      ? `${repo.stagedCount} staged, ${repo.modifiedCount} modified, ${repo.untrackedCount} untracked`
      : 'clean';
    const upstreamSummary = repo.upstream ? ` tracking ${repo.upstream}` : '';
    const divergence = repo.ahead > 0 || repo.behind > 0 ? `, ${repo.ahead} ahead/${repo.behind} behind` : '';
    const commit = repo.lastCommit ? `, last ${repo.lastCommit.hash}: ${repo.lastCommit.message}` : '';

    return `${repo.label}: ${changeSummary} on ${repo.branch ?? 'unknown branch'}${upstreamSummary}${divergence}${commit}`;
  });
}

export function buildOperatorContextPack(input: {
  context: OperatorContext;
  brief: OperatorBrief;
  dailyBrief: OperatorDailyBrief;
  changes: OperatorChangesSummary;
  insights: OperatorInsightsResponse;
  timelineEvents: OperatorTimelineEvent[];
  generatedAt?: string;
}): OperatorContextPackResponse {
  const timeline = input.timelineEvents.slice(0, MAX_TIMELINE_EVENTS);
  const sections: OperatorContextPackSection[] = [
    section('Current operator brief', input.brief.summary, [
      ...input.brief.risks,
      ...input.brief.recentEvents.slice(0, 4),
      ...input.brief.recommendations
    ]),
    section('Daily brief', input.dailyBrief.headline, [
      input.dailyBrief.healthSummary,
      ...input.dailyBrief.keyChanges,
      ...input.dailyBrief.warnings,
      ...input.dailyBrief.recommendations
    ]),
    section('What changed', input.changes.headline, [
      ...input.changes.meaningfulChanges,
      ...input.changes.newWarnings,
      ...input.changes.resolvedWarnings,
      input.changes.recommendedNextAction
    ]),
    section('Operator insights', `${input.insights.insights.length} rule-based insight${input.insights.insights.length === 1 ? '' : 's'} generated.`, input.insights.insights.flatMap((insight) => [
      `${insight.title}: ${insight.summary}`,
      ...insight.evidence.slice(0, 2),
      insight.recommendedAction ?? ''
    ])),
    section('Repository state summaries', `${input.context.repos.length} configured repo${input.context.repos.length === 1 ? '' : 's'} summarized.`, repoSummary(input.context)),
    section('Recent timeline', `${timeline.length} recent timeline event${timeline.length === 1 ? '' : 's'} included.`, timeline.map((event) => (
      `${event.occurredAt} ${event.type}/${event.severity}: ${event.title}: ${event.summary}`
    )))
  ];
  const evidenceItems = [
    evidence('brief', input.brief.summary),
    ...input.brief.risks.map((risk) => evidence('brief-risk', risk)),
    ...input.dailyBrief.keyChanges.map((change) => evidence('daily-brief', change)),
    ...input.changes.meaningfulChanges.map((change) => evidence('changes', change)),
    ...input.insights.insights.flatMap((insight) => insight.evidence.map((item) => evidence(`insight:${insight.title}`, item))),
    ...repoSummary(input.context).map((summary) => evidence('repo-state', summary)),
    ...timeline.map((event) => evidence(`timeline:${event.type}`, `${event.title}: ${event.summary}`))
  ].slice(0, MAX_EVIDENCE);
  const warnings = unique([
    ...input.brief.risks,
    ...input.dailyBrief.warnings,
    ...input.changes.newWarnings,
    ...input.context.collectionWarnings,
    ...input.context.repos.filter((repo) => repo.status !== 'available').map((repo) => `${repo.label} git status is ${repo.status}.`),
    ...input.context.disks.filter((disk) => disk.status !== 'available' || (disk.usedPercent ?? 0) >= 80).map((disk) => (
      `${disk.label} disk ${disk.status}${disk.usedPercent !== null ? ` at ${disk.usedPercent}% used` : ''}.`
    ))
  ]).slice(0, 20);
  const recommendedFocus = unique([
    ...input.brief.recommendations,
    ...input.dailyBrief.recommendations,
    input.changes.recommendedNextAction,
    ...input.insights.insights.map((insight) => insight.recommendedAction ?? '').filter(Boolean)
  ]).slice(0, 10);

  return operatorContextPackResponseSchema.parse({
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    readOnly: true,
    sections,
    evidence: evidenceItems,
    warnings,
    recommendedFocus,
    redactionApplied: true
  });
}

