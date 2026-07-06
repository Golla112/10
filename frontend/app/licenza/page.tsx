export default function Licenza() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#d8e4f0', marginBottom: 8 }}>Licenza & Conformità</h1>
      <div style={{ width: 40, height: 2, background: '#00b4d8', marginBottom: 28 }} />
      <div style={{
        background: 'rgba(0,200,150,0.06)', border: '1px solid rgba(0,200,150,0.15)',
        borderRadius: 12, padding: '20px 24px', marginBottom: 32,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 32 }}>✓</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#00c896', marginBottom: 4 }}>Licenza ADM Attiva</div>
          <div style={{ fontSize: 12, color: '#6e8aaa' }}>Numero licenza: 15088 — Agenzia delle Dogane e dei Monopoli</div>
        </div>
      </div>
      {[
        ['Autorizzazione', 'BigBet365 opera in conformità con il D.Lgs. 158/2019 e successive modifiche. La nostra licenza ADM garantisce che tutte le operazioni siano svolte nel rispetto della normativa italiana.'],
        ['Protezione dei Fondi', 'I fondi dei giocatori sono tenuti separati dai fondi operativi dell\'azienda su conti dedicati presso istituti bancari autorizzati.'],
        ['Gioco Responsabile', 'Adottiamo misure attive per prevenire la dipendenza dal gioco, inclusi limiti di deposito, auto-esclusione e accesso a risorse di supporto.'],
        ['Antiriciclaggio', 'Rispettiamo pienamente la normativa antiriciclaggio (D.Lgs. 231/2007) e collaboriamo con le autorità competenti.'],
      ].map(([title, text]) => (
        <div key={title as string} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#d8e4f0', marginBottom: 8 }}>{title}</h2>
          <p style={{ fontSize: 13, color: '#6e8aaa', lineHeight: 1.8 }}>{text}</p>
        </div>
      ))}
    </div>
  );
}
