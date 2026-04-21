'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { getApiBase, getStoredSession } from '@/lib/auth';
import AppImage from '@/components/ui/AppImage';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

export function isDocumentImageRef(ref) {
  return IMAGE_EXT.test(String(ref || ''));
}

export function formatDocumentFileCaption(ref) {
  if (!ref) return '';
  const base = String(ref).split(/[/\\]/).pop() || '';
  if (base.length <= 44) return base;
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot) : '';
  const stem = ext ? base.slice(0, base.length - ext.length) : base;
  return `${stem.slice(0, 20)}…${stem.slice(-8)}${ext}`;
}

export default function DocumentRecentThumb({ documentId, fileRef, alt, className }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!documentId || !isDocumentImageRef(fileRef)) {
      setSrc(null);
      setFailed(false);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;

    (async () => {
      try {
        const payload = await apiRequest(`/api/v1/documents/${documentId}/download`, { noCache: true });
        const path = typeof payload?.download_url === 'string' ? payload.download_url : '';
        if (!path || cancelled) return;

        const session = getStoredSession();
        const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
        const res = await fetch(url, {
          headers: session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {},
        });
        if (!res.ok || cancelled) throw new Error('fetch failed');
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setFailed(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setSrc(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, fileRef]);

  const wrapClass = className || 'mx-auto h-28 w-full';

  if (isDocumentImageRef(fileRef) && src) {
    return (
      <AppImage
        src={src}
        alt={alt}
        width={640}
        height={400}
        unoptimized
        sizes="280px"
        className={`${wrapClass} rounded-lg object-cover`}
      />
    );
  }

  if (isDocumentImageRef(fileRef) && !failed) {
    return <div className={`${wrapClass} skeleton min-h-[7rem] rounded-xl`} aria-hidden />;
  }

  return (
    <AppImage
      src="/assets/img/card-labs.svg"
      alt={alt}
      width={640}
      height={400}
      sizes="280px"
      className={`${wrapClass} object-contain`}
    />
  );
}
