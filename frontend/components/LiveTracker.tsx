'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    SBWidget?: {
      ctm: () => void;
      ltm: (eventId: number | string, selector: string) => void;
    };
  }
}

interface LiveTrackerProps {
  eventId: string | number; // ID numerico xcodetec (es. 63684725)
  locale?: string;
}

export default function LiveTracker({ eventId, locale = 'it' }: LiveTrackerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const containerId = `livetracker-${eventId}`;

  useEffect(() => {
    if (!eventId) return;

    const numericId = typeof eventId === 'string'
      ? Number(eventId.replace(/^xc_live_/, ''))
      : eventId;

    if (!numericId || isNaN(numericId)) return;

    const mount = () => {
      if (window.SBWidget) {
        window.SBWidget.ctm();
        window.SBWidget.ltm(numericId, `#${containerId}`);
      }
    };

    // Se lo script è già caricato, monta direttamente
    if (window.SBWidget) {
      mount();
      return;
    }

    // Altrimenti carica lo script
    const script = document.createElement('script');
    script.src = `https://livetracker.live/widgets/${locale}`;
    script.async = true;
    script.addEventListener('load', mount);
    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (window.SBWidget) {
        try { window.SBWidget.ctm(); } catch { /* noop */ }
      }
    };
  }, [eventId, locale, containerId]);

  return (
    <div
      id={containerId}
      ref={containerRef}
      className="widget-here"
      style={{
        width: '100%',
        minHeight: 280,
        background: 'var(--bg-surface)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    />
  );
}
