export const gameOpsV2Tokens = {
  spacing: {
    pageX: 'var(--go-space-page-x)',
    pageY: 'var(--go-space-page-y)',
    section: 'var(--go-space-section)',
    card: 'var(--go-space-card)'
  },
  radii: {
    shell: 'var(--go-radius-shell)',
    card: 'var(--go-radius-card)',
    control: 'var(--go-radius-control)',
    pill: 'var(--go-radius-pill)'
  },
  typography: {
    hero: 'var(--go-type-hero)',
    title: 'var(--go-type-title)',
    body: 'var(--go-type-body)',
    caption: 'var(--go-type-caption)'
  },
  surfaces: {
    background: 'var(--go-surface-bg)',
    panel: 'var(--go-surface-panel)',
    panelStrong: 'var(--go-surface-panel-strong)',
    glass: 'var(--go-surface-glass)'
  },
  borders: {
    quiet: 'var(--go-border-quiet)',
    strong: 'var(--go-border-strong)'
  },
  shadows: {
    shell: 'var(--go-shadow-shell)',
    card: 'var(--go-shadow-card)',
    glow: 'var(--go-shadow-glow)'
  },
  motion: {
    fast: 'var(--go-motion-fast)',
    base: 'var(--go-motion-base)',
    ease: 'var(--go-motion-ease)'
  },
  accents: {
    neutral: 'var(--go-accent-neutral)',
    healthy: 'var(--go-accent-healthy)',
    warning: 'var(--go-accent-warning)',
    offline: 'var(--go-accent-offline)',
    palworld: 'var(--go-accent-palworld)',
    valheim: 'var(--go-accent-valheim)'
  }
} as const;
