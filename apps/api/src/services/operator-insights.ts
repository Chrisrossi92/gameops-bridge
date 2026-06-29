import {
  operatorInsightsResponseSchema,
  type OperatorBrief,
  type OperatorChangesSummary,
  type OperatorDailyBrief,
  type OperatorDailyBriefConfidence,
  type OperatorInsight,
  type OperatorInsightsResponse,
  type OperatorTimelineEvent,
  type OperatorTimelineEventSeverity
} from '@gameops/shared';
import { redactSecrets } from './operator-redaction.js';

const MAX_INSIGHTS = 5;
const MAX_EVIDENCE = 5;

interface InsightCandidate extends OperatorInsight {
  score: number;
}

function clean(value: string, maxLength = 220): string {
  const cleaned = redactSecrets(value).replace(/\s+/g, ' ').trim();
  return (cleaned || 'No detail available.').slice(0, maxLength);
}

function evidence(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => clean(value, 180)).filter(Boolean))).slice(0, MAX_EVIDENCE);
}

function severityScore(severity: OperatorTimelineEventSeverity): number {
  if (severity === 'critical') {
    return 3;
  }

  if (severity === 'warning') {
    return 2;
  }

  return 1;
}

function confidenceFor(count: number): OperatorDailyBriefConfidence {
  if (count >= 3) {
    return 'high';
  }

  if (count > 0) {
    return 'medium';
  }

  return 'low';
}

function hasManyRepoChanges(text: string): boolean {
  const lower = text.toLowerCase();
  const total = [
    lower.match(/(\d+)\s+modified/)?.[1],
    lower.match(/(\d+)\s+untracked/)?.[1],
    lower.match(/(\d+)\s+staged/)?.[1]
  ].reduce((sum, value) => sum + Number(value ?? 0), 0);

  return lower.includes('dirty') && (total >= 5 || lower.includes('many') || lower.includes('large local repo change'));
}

function diskPercent(text: string): number | null {
  const value = Number(text.match(/(\d+(?:\.\d+)?)%/)?.[1]);
  return Number.isFinite(value) ? value : null;
}

function makeInsight(input: Omit<InsightCandidate, 'evidence'> & { evidence: string[] }): InsightCandidate {
  return {
    ...input,
    title: clean(input.title, 90),
    summary: clean(input.summary),
    evidence: evidence(input.evidence),
    recommendedAction: input.recommendedAction ? clean(input.recommendedAction) : undefined
  };
}

export function buildOperatorInsights(input: {
  brief: OperatorBrief;
  dailyBrief: OperatorDailyBrief;
  changes: OperatorChangesSummary;
  timelineEvents: OperatorTimelineEvent[];
  now?: Date;
}): OperatorInsightsResponse {
  const now = input.now ?? new Date();
  const candidates: InsightCandidate[] = [];
  const allText = [
    input.brief.summary,
    ...input.brief.risks,
    ...input.brief.recentEvents,
    ...input.brief.recommendations,
    input.dailyBrief.headline,
    input.dailyBrief.healthSummary,
    ...input.dailyBrief.keyChanges,
    ...input.dailyBrief.warnings,
    ...input.dailyBrief.recommendations,
    input.changes.headline,
    ...input.changes.meaningfulChanges,
    ...input.changes.newWarnings,
    ...input.changes.resolvedWarnings,
    input.changes.recommendedNextAction,
    ...input.timelineEvents.map((event) => event.summary)
  ];
  const dirtyRepoEvidence = allText.filter((text) => hasManyRepoChanges(text));

  if (dirtyRepoEvidence.length > 0) {
    candidates.push(makeInsight({
      score: 90,
      title: 'I noticed a repo with a larger local change set',
      summary: 'A configured repository appears dirty with enough local changes to review before deployment.',
      severity: 'warning',
      confidence: confidenceFor(dirtyRepoEvidence.length),
      evidence: dirtyRepoEvidence,
      recommendedAction: 'Review local repository changes before deploy or pull.'
    }));
  }

  const diskEvidence = allText.filter((text) => {
    const percent = diskPercent(text);
    return text.toLowerCase().includes('disk') && percent !== null && percent >= 80;
  });
  const highestDisk = Math.max(0, ...diskEvidence.map((text) => diskPercent(text) ?? 0));

  if (diskEvidence.length > 0) {
    candidates.push(makeInsight({
      score: highestDisk >= 90 ? 85 : 70,
      title: highestDisk >= 90 ? 'I noticed disk usage is high' : 'I noticed disk usage is climbing',
      summary: highestDisk >= 90
        ? 'Disk usage is over the warning threshold and should be reviewed before service changes.'
        : 'Disk usage is above 80%, so storage should stay on the watch list.',
      severity: highestDisk >= 90 ? 'warning' : 'info',
      confidence: confidenceFor(diskEvidence.length),
      evidence: diskEvidence,
      recommendedAction: 'Review disk usage and safe cleanup options on the VPS.'
    }));
  }

  const pm2Warnings = input.timelineEvents.filter((event) => (
    event.type === 'pm2' && event.severity !== 'info'
  ));

  if (pm2Warnings.length >= 2) {
    candidates.push(makeInsight({
      score: 80 + Math.min(pm2Warnings.length, 5),
      title: 'I noticed repeated PM2 warnings',
      summary: 'PM2 has produced repeated warning events in the recent operator timeline.',
      severity: pm2Warnings.some((event) => event.severity === 'critical') ? 'critical' : 'warning',
      confidence: confidenceFor(pm2Warnings.length),
      evidence: pm2Warnings.map((event) => event.summary),
      recommendedAction: 'Review PM2 service state from the VPS before manual action.'
    }));
  }

  if (input.changes.resolvedWarnings.length > 0) {
    candidates.push(makeInsight({
      score: 65,
      title: 'I noticed a warning may have cleared',
      summary: 'One or more recent warnings are no longer active in the current operator snapshot.',
      severity: 'info',
      confidence: input.changes.confidence,
      evidence: input.changes.resolvedWarnings,
      recommendedAction: 'Confirm the resolved warning remains stable on the next refresh.'
    }));
  }

  if (input.timelineEvents.length >= 10) {
    candidates.push(makeInsight({
      score: 60,
      title: 'I noticed more timeline activity than usual',
      summary: 'The operator timeline has a larger cluster of recent events, which may indicate active changes or repeated warnings.',
      severity: input.timelineEvents.some((event) => event.severity === 'critical') ? 'critical' : 'warning',
      confidence: 'high',
      evidence: [
        `${input.timelineEvents.length} operator timeline events are in the recent window.`,
        ...input.timelineEvents.slice(0, 3).map((event) => event.summary)
      ],
      recommendedAction: 'Review the recent timeline before making deployment or service changes.'
    }));
  }

  if (
    candidates.length === 0
    && input.brief.health === 'ok'
    && input.brief.risks.length === 0
    && input.changes.newWarnings.length === 0
  ) {
    candidates.push(makeInsight({
      score: 50,
      title: 'I noticed the operator signals are stable',
      summary: 'The current brief and change summary look stable and do not show active risks requiring action.',
      severity: 'info',
      confidence: input.timelineEvents.length > 0 ? 'medium' : 'low',
      evidence: [
        input.brief.summary,
        input.changes.headline,
        ...input.changes.unchangedSignals.slice(0, 2)
      ],
      recommendedAction: 'No immediate operator action is indicated from read-only signals.'
    }));
  }

  const insights = candidates
    .sort((left, right) => (severityScore(right.severity) - severityScore(left.severity)) || right.score - left.score)
    .slice(0, MAX_INSIGHTS)
    .map(({ score: _score, ...insight }) => insight);

  return operatorInsightsResponseSchema.parse({
    generatedAt: now.toISOString(),
    readOnly: true,
    insights: insights.length > 0 ? insights : [{
      title: 'I noticed the operator has limited signal',
      summary: 'There is not enough recent operator data to identify a meaningful pattern yet.',
      severity: 'info',
      confidence: 'low',
      evidence: ['No rule-based insight matched the current operator data.'],
      recommendedAction: 'Let the timeline collect more read-only observations.'
    }]
  });
}
