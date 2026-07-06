'use client';

import { useEffect, useRef } from 'react';

interface LiveWidgetProps {
  eventId?: number;
  locale?: string;
}

// Extend window type for SBWidget
declare global {
  interface Window {
    SBWidget?: {
      ctm: () => void;
      ltm: (eventId: number | string, selector: string) => void;
    };
  }
}

export default function LiveWidget({ eventId, locale = 'it' }: LiveWidgetProps) {
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load LiveTracker widget script
    const script = document.createElement('script');
    script.src = `https://livetracker.live/widgets/${locale}`;
    script.async = true;
    
    script.addEventListener('load', () => {
      if (window.SBWidget && containerRef.current) {
        window.SBWidget.ctm();
        if (eventId) {
          window.SBWidget.ltm(eventId, '.widget-here');
        }
      }
    });

    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current && document.body.contains(scriptRef.current)) {
        document.body.removeChild(scriptRef.current);
      }
    };
  }, [locale, eventId]);

  if (!eventId) return null;

  return (
    <div className="live-widget-container">
      <div 
        ref={containerRef}
        className="widget-here"
        style={{ 
          minHeight: '400px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '12px',
        }}
      />
    </div>
  );
}
