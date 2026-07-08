import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';

export type GameOpsTone = 'neutral' | 'healthy' | 'warning' | 'offline' | 'unknown' | 'palworld' | 'valheim';
export type GameOpsAtmospherePreset =
  | 'overview'
  | 'fantasy'
  | 'vanilla'
  | 'valheim'
  | 'players'
  | 'events'
  | 'community'
  | 'settings';

function joinClassNames(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}

export interface GameOpsShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GameOpsShell({ children, className, ...props }: GameOpsShellProps) {
  return (
    <div className={joinClassNames('gameops-shell', className)} {...props}>
      <div className="gameops-shell-background" aria-hidden="true" />
      <div className="gameops-shell-content">{children}</div>
    </div>
  );
}

export interface GameOpsPageProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GameOpsPage({ children, className, ...props }: GameOpsPageProps) {
  return (
    <div className={joinClassNames('gameops-page', className)} {...props}>
      {children}
    </div>
  );
}

export interface GameOpsHeroMetric {
  label: string;
  value: ReactNode;
}

export interface GameOpsHeroProps {
  eyebrow: string;
  title: string;
  body: string;
  media?: ReactNode;
  status?: ReactNode;
  primaryAction?: ReactNode;
  metrics?: GameOpsHeroMetric[];
  metricsLabel?: string;
}

export function GameOpsHero({ eyebrow, title, body, media, status, primaryAction, metrics = [], metricsLabel = 'Page summary' }: GameOpsHeroProps) {
  return (
    <section className="gameops-hero" aria-labelledby="gameops-v2-hero-title">
      <div className="gameops-hero-main">
        <span className="gameops-eyebrow">{eyebrow}</span>
        <h2 id="gameops-v2-hero-title">{title}</h2>
        <p>{body}</p>
      </div>
      <div className="gameops-hero-side">
        {media}
        {status}
        {primaryAction}
      </div>
      {metrics.length > 0 ? (
        <div className="gameops-hero-metrics" aria-label={metricsLabel}>
          {metrics.map((metric) => (
            <div key={metric.label} className="gameops-hero-metric">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export interface GameOpsAtmosphereFrameProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  preset: GameOpsAtmospherePreset;
  themeClassName?: string;
  overlayOpacity?: number;
  focalPoint?: string;
  crop?: string;
}

export function GameOpsAtmosphereFrame({
  children,
  className,
  preset,
  themeClassName,
  overlayOpacity = 0.58,
  focalPoint = '50% 50%',
  crop = 'cover',
  style,
  ...props
}: GameOpsAtmosphereFrameProps) {
  const atmosphereStyle = {
    '--go-atmosphere-overlay-opacity': String(overlayOpacity),
    '--go-atmosphere-focal-point': focalPoint,
    '--go-atmosphere-crop': crop,
    ...style
  } as CSSProperties;

  return (
    <div
      className={joinClassNames(
        'gameops-atmosphere-frame',
        `gameops-atmosphere-preset-${preset}`,
        themeClassName,
        className
      )}
      style={atmosphereStyle}
      {...props}
    >
      {children}
    </div>
  );
}

export interface GameOpsWorldBackdropProps extends HTMLAttributes<HTMLDivElement> {
  preset: GameOpsAtmospherePreset;
  themeClassName?: string;
}

export function GameOpsWorldBackdrop({ className, preset, themeClassName, ...props }: GameOpsWorldBackdropProps) {
  return (
    <div
      className={joinClassNames('gameops-world-backdrop', `gameops-world-backdrop-${preset}`, themeClassName, className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export interface GameOpsDesignSlotProps {
  designMode?: boolean;
  label?: string;
}

export function GameOpsDesignSlot({ designMode = false, label = 'Atmosphere design slot' }: GameOpsDesignSlotProps) {
  if (!designMode) {
    return null;
  }

  const controls = ['Replace Background', 'Adjust Crop', 'Focal Point', 'Overlay'];

  return (
    <div className="gameops-design-slot" aria-label={`${label} placeholder controls`}>
      <span>{label}</span>
      <div className="gameops-design-slot-controls">
        {controls.map((control) => (
          <button key={control} type="button" disabled>
            {control}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface GameOpsHeroMediaProps extends HTMLAttributes<HTMLDivElement> {
  preset: GameOpsAtmospherePreset;
  designMode?: boolean;
  label: string;
  imageSrc?: string;
  videoSrc?: string;
  overlayOpacity?: number;
  focalPoint?: string;
  crop?: string;
  themeClassName?: string;
}

export function GameOpsHeroMedia({
  className,
  preset,
  designMode = false,
  label,
  imageSrc,
  videoSrc,
  overlayOpacity,
  focalPoint,
  crop,
  themeClassName,
  ...props
}: GameOpsHeroMediaProps) {
  return (
    <GameOpsAtmosphereFrame
      className={joinClassNames('gameops-hero-media', className)}
      preset={preset}
      themeClassName={themeClassName}
      overlayOpacity={overlayOpacity}
      focalPoint={focalPoint}
      crop={crop}
      aria-label={label}
      {...props}
    >
      <GameOpsWorldBackdrop preset={preset} themeClassName={themeClassName} />
      {videoSrc ? (
        <video className="gameops-hero-media-asset" src={videoSrc} autoPlay muted loop playsInline aria-hidden="true" />
      ) : null}
      {imageSrc ? <img className="gameops-hero-media-asset" src={imageSrc} alt="" aria-hidden="true" /> : null}
      {!imageSrc && !videoSrc ? (
        <div className="gameops-hero-media-placeholder" aria-hidden="true">
          <span />
        </div>
      ) : null}
      <div className="gameops-hero-media-overlay" aria-hidden="true" />
      <GameOpsDesignSlot designMode={designMode} label={label} />
    </GameOpsAtmosphereFrame>
  );
}

export interface GameOpsSectionProps extends HTMLAttributes<HTMLElement> {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function GameOpsSection({ eyebrow, title, description, actions, children, className, ...props }: GameOpsSectionProps) {
  return (
    <section className={joinClassNames('gameops-section', className)} {...props}>
      <div className="gameops-section-header">
        <div>
          {eyebrow ? <span className="gameops-eyebrow">{eyebrow}</span> : null}
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="gameops-section-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export interface GameOpsCardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  tone?: GameOpsTone;
  interactive?: boolean;
}

export function GameOpsCard({ children, className, tone = 'neutral', interactive = false, ...props }: GameOpsCardProps) {
  return (
    <article
      className={joinClassNames(
        'gameops-card',
        `gameops-card-${tone}`,
        interactive && 'gameops-card-interactive',
        className
      )}
      {...props}
    >
      {children}
    </article>
  );
}

export interface GameOpsPrimaryActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}

export function GameOpsPrimaryAction({ children, className, variant = 'primary', ...props }: GameOpsPrimaryActionProps) {
  return (
    <button
      type="button"
      className={joinClassNames('gameops-primary-action', `gameops-primary-action-${variant}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export interface GameOpsStatusPillProps {
  children: ReactNode;
  tone?: GameOpsTone;
}

export function GameOpsStatusPill({ children, tone = 'neutral' }: GameOpsStatusPillProps) {
  return <span className={`gameops-status-pill gameops-status-pill-${tone}`}>{children}</span>;
}

export interface GameOpsActivityItem {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
  tone?: GameOpsTone;
  action?: ReactNode;
}

export interface GameOpsActivityListProps {
  items: GameOpsActivityItem[];
  emptyTitle: string;
  emptyDescription: string;
}

export function GameOpsActivityList({ items, emptyTitle, emptyDescription }: GameOpsActivityListProps) {
  if (items.length === 0) {
    return (
      <GameOpsCard className="gameops-empty-card">
        <span className="gameops-eyebrow">{emptyTitle}</span>
        <p>{emptyDescription}</p>
      </GameOpsCard>
    );
  }

  return (
    <ol className="gameops-activity-list">
      {items.map((item) => (
        <li key={item.id} className="gameops-activity-item">
          <div className="gameops-activity-marker" aria-hidden="true">
            <span className={`gameops-activity-dot gameops-activity-dot-${item.tone ?? 'neutral'}`} />
          </div>
          <div className="gameops-activity-copy">
            <div className="gameops-activity-title-row">
              <strong>{item.title}</strong>
              {item.meta ? <span>{item.meta}</span> : null}
            </div>
            {item.detail ? <p>{item.detail}</p> : null}
          </div>
          {item.action ? <div className="gameops-activity-action">{item.action}</div> : null}
        </li>
      ))}
    </ol>
  );
}

export interface GameOpsTimelineItem {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
  groupLabel: string;
  sourceLabel?: string;
  typeLabel?: string;
  tone?: GameOpsTone;
  action?: ReactNode;
}

export interface GameOpsTimelineDetailProps {
  items: GameOpsTimelineItem[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  emptyTitle: string;
  emptyDescription: string;
  detailTitle?: string;
}

export function GameOpsTimelineDetail({
  items,
  selectedItemId,
  onSelectItem,
  emptyTitle,
  emptyDescription,
  detailTitle = 'Event detail'
}: GameOpsTimelineDetailProps) {
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;
  const groups = items.reduce<Array<{ label: string; items: GameOpsTimelineItem[] }>>((accumulator, item) => {
    const existingGroup = accumulator.find((group) => group.label === item.groupLabel);

    if (existingGroup) {
      existingGroup.items.push(item);
      return accumulator;
    }

    accumulator.push({ label: item.groupLabel, items: [item] });
    return accumulator;
  }, []);

  if (items.length === 0) {
    return (
      <GameOpsCard className="gameops-empty-card">
        <span className="gameops-eyebrow">{emptyTitle}</span>
        <p>{emptyDescription}</p>
      </GameOpsCard>
    );
  }

  return (
    <div className="gameops-timeline-detail">
      <div className="gameops-timeline-feed" aria-label="Event timeline">
        {groups.map((group) => (
          <section key={group.label} className="gameops-timeline-group">
            <h4>{group.label}</h4>
            <ol>
              {group.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`gameops-timeline-item ${selectedItem?.id === item.id ? 'gameops-timeline-item-selected' : ''}`}
                    aria-pressed={selectedItem?.id === item.id}
                    onClick={() => onSelectItem(item.id)}
                  >
                    <span className={`gameops-timeline-dot gameops-timeline-dot-${item.tone ?? 'neutral'}`} aria-hidden="true" />
                    <span className="gameops-timeline-item-copy">
                      <strong>{item.title}</strong>
                      {item.detail ? <span>{item.detail}</span> : null}
                      <small>{[item.meta, item.sourceLabel, item.typeLabel].filter(Boolean).join(' | ')}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <aside className="gameops-timeline-selected" aria-label={detailTitle}>
        <span className="gameops-eyebrow">{detailTitle}</span>
        <h4>{selectedItem?.title ?? 'No event selected'}</h4>
        {selectedItem?.detail ? <p>{selectedItem.detail}</p> : <p>Select an event to inspect available detail.</p>}
        {selectedItem ? (
          <dl className="gameops-timeline-selected-meta">
            <div><dt>When</dt><dd>{selectedItem.meta ?? 'time unknown'}</dd></div>
            <div><dt>Source</dt><dd>{selectedItem.sourceLabel ?? 'loaded summary'}</dd></div>
            <div><dt>Type</dt><dd>{selectedItem.typeLabel ?? 'event'}</dd></div>
          </dl>
        ) : null}
        {selectedItem?.action ? <div className="gameops-timeline-selected-action">{selectedItem.action}</div> : null}
      </aside>
    </div>
  );
}
