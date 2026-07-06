'use client';
import Link from 'next/link';

export default function DuelliPage() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 48px' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #060d1a 100%)',
        border: '1px solid #1a2535',
        borderRadius: 14,
        padding: '28px 32px',
        marginBottom: 28,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, #00b4d8, transparent)',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #005f73, #00b4d8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(0,180,216,0.35)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Duelli
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Scommesse fantasy su sfide tra squadre di leghe diverse
            </p>
          </div>
        </div>
        <div style={{
          background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.15)',
          borderRadius: 8, padding: '12px 16px', marginTop: 16,
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            I Duelli sono eventi fantasy in cui le squadre partecipanti non si affrontano direttamente.
            Il risultato viene determinato dai gol segnati da ciascuna squadra nella propria partita reale,
            al termine dei tempi regolamentari.
          </p>
        </div>
      </div>

      {/* Example box */}
      <div style={{ marginBottom: 28 }}>
        <SectionTitle>Come funziona — Esempio</SectionTitle>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center',
          marginBottom: 16,
        }}>
          <MatchBox league="Serie A" home="Milan" away="Udinese" result="2 - 0" />
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}>+</div>
          <MatchBox league="La Liga" home="Real Madrid" away="Barcelona" result="4 - 3" />
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #0a1628, #060d1a)',
          border: '1px solid rgba(0,180,216,0.25)',
          borderRadius: 12, padding: '18px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TeamBadge name="Milan" color="#1d4ed8" />
            <div>
              <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Duello</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Milan vs Barcelona</div>
            </div>
          </div>
          <div style={{
            background: 'rgba(0,180,216,0.1)', border: '1px solid rgba(0,180,216,0.3)',
            borderRadius: 10, padding: '10px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Risultato Duello</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#00b4d8', letterSpacing: '-0.02em' }}>2 — 3</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Milan 2 gol · Barcelona 3 gol</div>
          </div>
          <TeamBadge name="Barcelona" color="#374151" />
        </div>
      </div>

      {/* Rules */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SectionTitle>Regole dei Duelli</SectionTitle>

        <RuleCard
          number="01"
          title="Risultato"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
            </svg>
          }
        >
          Il risultato di un Duello è determinato dai gol segnati dai due partecipanti nelle rispettive
          partite reali al termine dei tempi regolamentari. I tempi supplementari e i rigori non vengono considerati.
        </RuleCard>

        <RuleCard
          number="02"
          title="Data e Ora di Inizio"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          }
        >
          La data e l&apos;ora di inizio di un evento Duello coincidono sempre con la partita reale che inizia
          prima tra le due. Se per errore un Duello fosse disponibile per le scommesse dopo l&apos;inizio di
          una delle partite reali, tutte le scommesse ricevute dopo tale orario saranno considerate <strong style={{ color: '#f87171' }}>NULLE</strong>.
        </RuleCard>

        <RuleCard
          number="03"
          title="Tipi di Scommessa"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 12h6M9 16h4"/>
            </svg>
          }
        >
          I tipi di scommessa degli eventi Duello seguono le stesse regole del calcio: 1X2, Over/Under,
          GG/NG, Doppia Chance e tutti gli altri mercati disponibili.
        </RuleCard>

        <RuleCard
          number="04"
          title="Eventi Rinviati o Interrotti"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        >
          Se una o entrambe le partite reali vengono rinviate, le scommesse sul Duello rimangono in
          sospeso per <strong style={{ color: 'var(--text-primary)' }}>24 ore</strong>. Se le partite non si disputano entro tale termine,
          tutte le scommesse sul Duello saranno dichiarate <strong style={{ color: '#f87171' }}>NULLE</strong>.
          Lo stesso vale in caso di sospensione non ripresa entro 24 ore.
        </RuleCard>
      </div>

      {/* CTA */}
      <div style={{
        marginTop: 32, textAlign: 'center',
        background: 'linear-gradient(135deg, #0a1628, #060d1a)',
        border: '1px solid #1a2535', borderRadius: 14, padding: '24px 20px',
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          I Duelli saranno disponibili prossimamente. Torna a controllare!
        </p>
        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg, #005f73, #0096c7)',
          color: '#fff', borderRadius: 8, padding: '10px 20px',
          fontSize: 12, fontWeight: 700, textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(0,180,216,0.3)',
        }}>
          Torna agli Sport
        </Link>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.12em',
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
    }}>
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'block' }} />
      {children}
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'block' }} />
    </div>
  );
}

function MatchBox({ league, home, away, result }: { league: string; home: string; away: string; result: string }) {
  return (
    <div style={{
      background: '#0a0d14', border: '1px solid #1a2030',
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        {league}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{home}</span>
        <span style={{
          fontSize: 14, fontWeight: 900, color: 'var(--text-primary)',
          background: '#111520', border: '1px solid #1a2030',
          borderRadius: 6, padding: '3px 10px',
        }}>{result}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{away}</span>
      </div>
    </div>
  );
}

function TeamBadge({ name, color }: { name: string; color: string }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: `linear-gradient(135deg, ${color}cc, ${color})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0,
      boxShadow: `0 4px 12px ${color}44`,
    }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function RuleCard({ number, title, icon, children }: {
  number: string; title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#0a0d14', border: '1px solid #1a2030',
      borderRadius: 12, padding: '16px 18px',
      display: 'flex', gap: 16, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: 'linear-gradient(135deg, #005f73, #0096c7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', boxShadow: '0 4px 12px rgba(0,180,216,0.25)',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{number}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</p>
      </div>
    </div>
  );
}
