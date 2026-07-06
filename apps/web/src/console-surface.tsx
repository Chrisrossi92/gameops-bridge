/* @jsxRuntime classic */
import React, { type ReactNode } from 'react';

export interface ConsoleSummaryMetric {
  label: string;
  value: string | number;
}

interface ConsoleSurfaceSectionProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  className: string;
  headingClassName: string;
  gridClassName: string;
  quietClassName: string;
  quiet?: boolean;
}

interface ConsoleSummaryCardProps {
  eyebrow: string;
  question: string;
  statusLabel: string;
  statusTone: 'high' | 'medium' | 'low';
  summary: string;
  details: string[];
  metrics: ConsoleSummaryMetric[];
  className: string;
  mainClassName: string;
  detailGridClassName: string;
  metricHeading: string;
}

function getConsoleHeadingId(title: string): string {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-heading`;
}

export function ConsoleSurfaceSection({
  eyebrow,
  title,
  description,
  children,
  className,
  headingClassName,
  gridClassName,
  quietClassName,
  quiet = false
}: ConsoleSurfaceSectionProps) {
  const headingId = getConsoleHeadingId(title);
  const sectionClassName = `console-surface-section ${className}${quiet ? ` console-surface-section-quiet ${quietClassName}` : ''}`;

  return (
    <section className={sectionClassName} aria-labelledby={headingId}>
      <div className={`console-surface-heading ${headingClassName}`}>
        <span className="summary-label">{eyebrow}</span>
        <h2 id={headingId}>{title}</h2>
        <p className="subtle">{description}</p>
      </div>
      <div className={`console-surface-grid ${gridClassName}`}>
        {children}
      </div>
    </section>
  );
}

export function ConsoleSummaryCard({
  eyebrow,
  question,
  statusLabel,
  statusTone,
  summary,
  details,
  metrics,
  className,
  mainClassName,
  detailGridClassName,
  metricHeading
}: ConsoleSummaryCardProps) {
  return (
    <article className={`console-summary-card ${className}`}>
      <div className={`console-summary-main ${mainClassName}`}>
        <div>
          <span className="summary-label">{eyebrow}</span>
          <h2>{question}</h2>
          <p>{summary}</p>
        </div>
        <span className={`confidence-badge confidence-${statusTone}`}>{statusLabel}</span>
      </div>

      <div className={`console-summary-detail-grid ${detailGridClassName}`}>
        <section>
          <h3>Operator read</h3>
          <ul>
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>{metricHeading}</h3>
          <dl>
            {metrics.map((metric) => (
              <React.Fragment key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </section>
      </div>
    </article>
  );
}
