'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

const STORAGE_KEY = 'layout-preference-v2';

type LayoutType = 'desktop' | 'mobile';

interface LayoutContextType {
  layout: LayoutType;
  isDesktop: boolean;
  isMobile: boolean;
  toggle: () => void;
  setLayout: (layout: LayoutType) => void;
  mounted: boolean;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<LayoutType>('mobile');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setLayoutState(stored as LayoutType);
    } else {
      // Auto-detect based on screen width
      setLayoutState(window.innerWidth >= 1024 ? 'desktop' : 'mobile');
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    localStorage.setItem(STORAGE_KEY, layout);

    // Solo classi su body: il viewport non va riscritto (es. width=1280 su mobile rendeva la pagina illeggibile / “senza design”).
    document.body.classList.remove('layout-desktop', 'layout-mobile');
    document.body.classList.add(`layout-${layout}`);

    window.dispatchEvent(new CustomEvent('layoutchange', { detail: { layout } }));
  }, [layout, mounted]);

  const toggle = () => setLayoutState(prev => prev === 'desktop' ? 'mobile' : 'desktop');
  const setLayout = (newLayout: LayoutType) => setLayoutState(newLayout);

  return (
    <LayoutContext.Provider value={{ 
      layout, 
      isDesktop: layout === 'desktop', 
      isMobile: layout === 'mobile',
      toggle, 
      setLayout,
      mounted 
    }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return context;
}

// Legacy hook for backward compatibility
export function useLayoutToggle() {
  const { isDesktop, toggle, mounted } = useLayout();
  return { isDesktopLayout: isDesktop, toggle, mounted };
}

export default function LayoutToggle() {
  const { isDesktop, toggle, mounted, layout } = useLayout();

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      className="fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-[#14805e] hover:bg-[#1a9c70] text-white rounded-full shadow-lg transition-all md:bottom-4 font-medium text-sm"
      title={isDesktop ? 'Passa a vista mobile' : 'Passa a vista desktop'}
    >
      {isDesktop ? (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="hidden sm:inline">Mobile</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="hidden sm:inline">Desktop</span>
        </>
      )}
    </button>
  );
}

// Hook for components to adapt to layout
export function useResponsiveLayout() {
  const { isDesktop, isMobile } = useLayout();
  return { isDesktop, isMobile };
}
