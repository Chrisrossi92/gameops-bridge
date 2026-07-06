/* @jsxRuntime classic */
import React, { type ReactNode } from 'react';
import { ConsoleSurfaceSection, ConsoleSummaryCard, type ConsoleSummaryMetric } from './console-surface.tsx';

interface EvidenceSurfaceSectionProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  quiet?: boolean;
}

interface EvidenceSummaryCardProps {
  eyebrow: string;
  question: string;
  statusLabel: string;
  statusTone: 'high' | 'medium' | 'low';
  summary: string;
  details: string[];
  metrics: ConsoleSummaryMetric[];
}

export function EvidenceSurfaceSection({ eyebrow, title, description, children, quiet = false }: EvidenceSurfaceSectionProps) {
  return (
    <ConsoleSurfaceSection
      eyebrow={eyebrow}
      title={title}
      description={description}
      className="evidence-surface-section"
      headingClassName="evidence-surface-heading"
      gridClassName="evidence-surface-grid"
      quietClassName="evidence-surface-section-quiet"
      quiet={quiet}
    >
      {children}
    </ConsoleSurfaceSection>
  );
}

export function EvidenceSummaryCard({ eyebrow, question, statusLabel, statusTone, summary, details, metrics }: EvidenceSummaryCardProps) {
  return (
    <ConsoleSummaryCard
      eyebrow={eyebrow}
      question={question}
      statusLabel={statusLabel}
      statusTone={statusTone}
      summary={summary}
      details={details}
      metrics={metrics}
      className="evidence-summary-card"
      mainClassName="evidence-summary-main"
      detailGridClassName="evidence-summary-detail-grid"
      metricHeading="Current evidence"
    />
  );
}
