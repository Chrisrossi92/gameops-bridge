/* @jsxRuntime classic */
import React, { type ReactNode } from 'react';
import { ConsoleSurfaceSection } from './console-surface.tsx';

interface PlayersSurfaceSectionProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  quiet?: boolean;
}

export function PlayersSurfaceSection({ eyebrow, title, description, children, quiet = false }: PlayersSurfaceSectionProps) {
  return (
    <ConsoleSurfaceSection
      eyebrow={eyebrow}
      title={title}
      description={description}
      className="players-surface-section"
      headingClassName="players-surface-heading"
      gridClassName="players-surface-grid"
      quietClassName="players-surface-section-quiet"
      quiet={quiet}
    >
      {children}
    </ConsoleSurfaceSection>
  );
}
