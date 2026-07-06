'use client';
import { usePathname } from 'next/navigation';

const HIDE_BETSLIP_PATHS = ['/dashboard', '/print', '/admin', '/verifica', '/betslip', '/chi-siamo', '/contatti', '/cookie', '/faq', '/gioco-responsabile', '/licenza', '/privacy', '/regole', '/termini'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideBetSlip = HIDE_BETSLIP_PATHS.some(p => pathname?.startsWith(p));

  // Su homepage (/), la betslip è gestita direttamente in page.tsx
  // Su altre pagine, mostra solo il contenuto
  return <>{children}</>;
}
