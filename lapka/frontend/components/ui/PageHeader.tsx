'use client';

/**
 * Consistent page chrome for workspace routes (health-tech spacing + optional test hooks).
 */
export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions = null,
  className = '',
  testId = 'page-header',
  titleTestId,
}) {
  return (
    <header className={`page-header ${className}`.trim()} data-testid={testId}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="page-header-eyebrow">{eyebrow}</p>
        ) : null}
        <h1 className="page-title" data-testid={titleTestId || (testId ? `${testId}-title` : undefined)}>
          {title}
        </h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
