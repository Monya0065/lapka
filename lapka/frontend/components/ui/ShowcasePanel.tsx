'use client';

import Image from 'next/image';

export default function ShowcasePanel({
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt,
  badges = [],
  align = 'right',
  className = '',
  compact = false,
}) {
  const imageFirst = align === 'left';

  const textBlock = (
    <div className="space-y-4">
      {eyebrow ? (
        <span className="inline-flex rounded-full border border-lapka-200 bg-white/90 px-4 py-1.5 text-sm font-bold text-lapka-700 shadow-sm">
          {eyebrow}
        </span>
      ) : null}
      <div className="space-y-3">
        <h2 className={`font-black tracking-tight text-lapka-950 ${compact ? 'text-3xl md:text-[2.6rem]' : 'text-[2.6rem] md:text-[3.6rem]'}`}>
          {title}
        </h2>
        {description ? <p className={`max-w-3xl leading-8 text-lapka-700 ${compact ? 'text-lg md:text-[1.08rem]' : 'text-xl md:text-[1.22rem]'}`}>{description}</p> : null}
      </div>
      {badges.length ? (
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge}
              className="inline-flex rounded-2xl border border-lapka-200 bg-white/90 px-4 py-2 text-sm font-semibold text-lapka-700 shadow-sm"
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );

  const visualBlock = (
    <div className={`showcase-panel overflow-hidden ${compact ? 'min-h-[280px]' : 'min-h-[360px]'}`}>
      <div className="showcase-orb left-8 top-10 h-28 w-28 bg-[radial-gradient(circle_at_center,rgba(97,196,255,0.26),rgba(97,196,255,0))]" />
      <div className="showcase-orb right-10 top-16 h-20 w-20 bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.28),rgba(45,212,191,0))]" />
      <div className="showcase-orb bottom-8 left-1/4 h-24 w-24 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2),rgba(59,130,246,0))]" />
      <div className="showcase-floating right-4 top-4">Lapka 2026</div>
      <div className={`relative z-[1] mx-auto mt-4 ${compact ? 'h-[220px] md:h-[250px]' : 'h-[290px] md:h-[340px]'} w-full max-w-[560px]`}>
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 90vw, 560px"
          className="object-contain drop-shadow-[0_30px_40px_rgba(12,31,59,0.18)]"
        />
      </div>
    </div>
  );

  return (
    <section className={`showcase-shell ${className}`}>
      <div className={`showcase-grid items-center ${imageFirst ? 'lg:grid-cols-[360px_minmax(0,1fr)]' : ''}`}>
        {imageFirst ? (
          <>
            {visualBlock}
            {textBlock}
          </>
        ) : (
          <>
            {textBlock}
            {visualBlock}
          </>
        )}
      </div>
    </section>
  );
}
