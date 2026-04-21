export default function Card({
  title,
  subtitle,
  action,
  className = '',
  children,
  dense = false,
  tone = 'default',
  headerSize = 'lg',
}) {
  const toneClass = tone === 'tinted'
    ? 'bg-gradient-to-b from-white to-lapka-50/90'
    : tone === 'mint'
      ? 'bg-gradient-to-b from-white to-emerald-50/70'
      : '';
  const titleClass = headerSize === 'md'
    ? 'text-xl font-extrabold tracking-tight text-lapka-900 md:text-2xl'
    : 'text-2xl font-extrabold tracking-tight text-lapka-900 md:text-[2rem]';
  return (
    <article className={`surface-card ${toneClass} ${dense ? 'p-4' : 'p-5 md:p-6'} ${className}`}>
      {(title || subtitle || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            {title ? <h2 className={titleClass}>{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-base leading-relaxed text-lapka-600 md:text-[1.05rem]">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </article>
  );
}
