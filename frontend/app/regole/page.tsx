export default function RegolePage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Regole e Condizioni</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 32 }}>Ultimo aggiornamento: Gennaio 2025</p>

      <Section title="1. Accettazione delle scommesse">
        <p>Tutte le scommesse sono accettate a discrezione del gestore. Il gestore si riserva il diritto di limitare o rifiutare qualsiasi scommessa senza obbligo di motivazione.</p>
        <p>Una scommessa è considerata valida solo dopo la conferma del sistema con l&apos;emissione del codice schedina.</p>
      </Section>

      <Section title="2. Quote e mercati">
        <p>Le quote sono soggette a variazioni fino al momento dell&apos;accettazione della scommessa. La quota applicata è quella vigente al momento della conferma.</p>
        <p>In caso di errore evidente nelle quote (es. quota inferiore a 1.01 o superiore a 1000), il gestore si riserva il diritto di annullare la scommessa e rimborsare l&apos;importo puntato.</p>
      </Section>

      <Section title="3. Risultati e liquidazione">
        <p>I risultati ufficiali sono quelli comunicati dalla federazione o dall&apos;organismo competente al termine dell&apos;evento. Eventuali risultati provvisori non sono validi ai fini della liquidazione.</p>
        <p>Le scommesse su eventi rinviati o sospesi vengono annullate e l&apos;importo rimborsato, salvo diversa indicazione.</p>
        <p>In caso di errore nella liquidazione, il gestore si riserva il diritto di correggere il risultato entro 48 ore dall&apos;evento.</p>
      </Section>

      <Section title="4. Scommesse multiple">
        <p>Le scommesse multiple (accumulator) richiedono che tutti gli esiti selezionati siano corretti per risultare vincenti. La quota totale è il prodotto delle singole quote.</p>
        <p>Il numero massimo di selezioni per schedina è 20.</p>
      </Section>

      <Section title="5. Pagamenti">
        <p>Le vincite vengono pagate previa verifica della schedina tramite il codice univoco. Il gestore si riserva fino a 24 ore per il pagamento delle vincite.</p>
        <p>In caso di sospetto di frode o irregolarità, il pagamento può essere sospeso fino alla conclusione delle verifiche.</p>
      </Section>

      <Section title="6. Controversie">
        <p>Qualsiasi controversia deve essere comunicata al gestore entro 7 giorni dall&apos;evento. Trascorso tale termine, la scommessa si intende accettata senza riserve.</p>
        <p>La decisione del gestore è definitiva e vincolante in tutte le questioni relative all&apos;interpretazione delle regole.</p>
      </Section>

      <Section title="7. Limitazioni di responsabilità">
        <p>Il gestore non è responsabile per perdite derivanti da malfunzionamenti tecnici, interruzioni di servizio o cause di forza maggiore.</p>
        <p>L&apos;utente è responsabile della correttezza delle selezioni effettuate prima della conferma della schedina.</p>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}
