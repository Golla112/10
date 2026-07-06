'use client';
import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-[2] mt-auto border-t border-white/10 bg-[#050911]/95">
      <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#8ea7bc]">BigBet365</p>
          <h3 className="mt-3 text-3xl font-black uppercase tracking-[0.08em] text-white">Sportsbook premium</h3>
          <p className="mt-3 max-w-[34ch] text-sm leading-6 text-[#bfd1e1]">
            Esperienza più solida tra prematch, live, verifica schedine e dashboard con un look più
            credibile per un bookmaker di fascia alta.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-200">Gioco responsabile</span>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-bold text-amber-100">18+ only</span>
          </div>
        </div>

        {[
          {
            title: 'Scommesse',
            links: [
              { href: '/prematch', label: 'Prematch' },
              { href: '/live', label: 'Live' },
              { href: '/betslip', label: 'Coupon' },
              { href: '/verifica', label: 'Verifica schedina' },
            ],
          },
          {
            title: 'Informazioni',
            links: [
              { href: '/chi-siamo', label: 'Chi siamo' },
              { href: '/regole', label: 'Regole' },
              { href: '/privacy', label: 'Privacy' },
              { href: '/cookie', label: 'Cookie' },
            ],
          },
          {
            title: 'Supporto',
            links: [
              { href: '/contatti', label: 'Contatti' },
              { href: '/faq', label: 'FAQ' },
              { href: '/termini', label: 'Termini' },
              { href: '/licenza', label: 'Licenza' },
            ],
          },
        ].map((group) => (
          <div key={group.title} className="rounded-3xl border border-white/8 bg-white/[0.02] p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#7d99b4]">{group.title}</p>
            <div className="mt-4 flex flex-col gap-3">
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[#d6e5f2] transition-colors hover:text-[#7cf0c4]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/8 bg-black/20 px-5 py-4">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 text-xs text-[#8ea7bc] md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {['18+', 'Compliance', 'Supporto', 'Verifica rapida'].map((badge) => (
              <span key={badge} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-[#bfd1e1]">
                {badge}
              </span>
            ))}
          </div>
          <span>© {year} BigBet365. Tutti i diritti riservati.</span>
        </div>
      </div>
    </footer>
  );
}
