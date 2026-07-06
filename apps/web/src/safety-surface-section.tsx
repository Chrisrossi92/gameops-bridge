/* @jsxRuntime classic */
import React, { type ReactNode } from 'react';
import { ConsoleSurfaceSection, ConsoleSummaryCard, type ConsoleSummaryMetric } from './console-surface.tsx';

interface SafetySurfaceSectionProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  quiet?: boolean;
}

interface SafetySummaryCardProps {
  eyebrow: string;
  question: string;
  statusLabel: string;
  statusTone: 'high' | 'medium' | 'low';
  summary: string;
  details: string[];
  metrics: ConsoleSummaryMetric[];
}

export function SafetySurfaceSection({ eyebrow, title, description, children, quiet = false }: SafetySurfaceSectionProps) {
  return (
    <ConsoleSurfaceSection
      eyebrow={eyebrow}
      title={title}
      description={description}
      className="safety-surface-section"
      headingClassName="safety-surface-heading"
      gridClassName="safety-surface-grid"
      quietClassName="safety-surface-section-quiet"
      quiet={quiet}
    >
      {children}
    </ConsoleSurfaceSection>
  );
}

export function SafetySummaryCard({ eyebrow, question, statusLabel, statusTone, summary, details, metrics }: SafetySummaryCardProps) {
  return (
    <ConsoleSummaryCard
      eyebrow={eyebrow}
      question={question}
      statusLabel={statusLabel}
      statusTone={statusTone}
      summary={summary}
      details={details}
      metrics={metrics}
      className="safety-summary-card"
      mainClassName="safety-summary-main"
      detailGridClassName="safety-summary-detail-grid"
      metricHeading="Current signals"
    />
  );
}
