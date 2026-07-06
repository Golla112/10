export default function GiocoResponsabilePage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Gioco Responsabile</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 32 }}>
        Il gioco deve essere un intrattenimento, non una fonte di problemi.
      </p>

      <div style={{
        background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.2)',
        borderRadius: 10, padding: '16px 20px', marginBottom: 32,
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Se ritieni di avere un problema con il gioco d&apos;azzardo, ti invitiamo a contattare il servizio di supporto
          nazionale <strong style={{ color: 'var(--accent)' }}>Gioca Responsabile</strong> al numero verde gratuito
          <strong style={{ color: 'var(--text-primary)' }}> 800 558 822</strong> (attivo 24/7).
        </p>
      </div>

      <Section title="Riconosci i segnali di allarme">
        <Item>Scommetti più di quanto puoi permetterti di perdere</Item>
        <Item>Cerchi di recuperare le perdite con nuove scommesse</Item>
        <Item>Il gioco interferisce con il lavoro, la famiglia o le relazioni</Item>
        <Item>Senti il bisogno di scommettere somme sempre maggiori</Item>
        <Item>Menti a familiari o amici riguardo alle tue abitudini di gioco</Item>
        <Item>Usi il gioco come modo per sfuggire a problemi o stati d&apos;animo negativi</Item>
      </Section>

      <Section title="Consigli per giocare in modo responsabile">
        <Item>Stabilisci un budget giornaliero o settimanale e rispettalo</Item>
        <Item>Considera le perdite come il costo dell&apos;intrattenimento</Item>
        <Item>Non scommettere mai sotto l&apos;effetto di alcol o sostanze</Item>
        <Item>Fai pause regolari e non inseguire le perdite</Item>
        <Item>Non scommettere mai denaro destinato a spese essenziali</Item>
        <Item>Tieni traccia del tempo e del denaro speso nel gioco</Item>
      </Section>

      <Section title="Strumenti di autocontrollo">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Se ritieni di aver bisogno di limitare la tua attività di gioco, contatta il gestore per richiedere
          l&apos;impostazione di limiti di deposito, limiti di scommessa o l&apos;autoesclusione temporanea o permanente.
        </p>
      </Section>

      <Section title="Risorse di supporto">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Resource name="Gioca Responsabile (ADM)" phone="800 558 822" url="https://www.adm.gov.it" />
          <Resource name="Gambling Therapy" url="https://www.gamblingtherapy.org" />
          <Resource name="Giocatori Anonimi Italia" url="https://www.giocatorianonimi.it" />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
      <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>—</span>
      <span>{children}</span>
    </div>
  );
}

function Resource({ name, phone, url }: { name: string; phone?: string; url: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '12px 14px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{name}</p>
        {phone && <p style={{ fontSize: 11, color: 'var(--accent)' }}>{phone}</p>}
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{
        fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 5, padding: '4px 10px',
      }}>
        Visita
      </a>
    </div>
  );
}
