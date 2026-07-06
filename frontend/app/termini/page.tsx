export default function Termini() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#d8e4f0', marginBottom: 8 }}>Termini di Servizio</h1>
      <div style={{ width: 40, height: 2, background: '#00b4d8', marginBottom: 28 }} />
      {[
        ['1. Accettazione dei Termini', 'Utilizzando BigBet365 accetti integralmente i presenti Termini di Servizio. Se non accetti, ti preghiamo di non utilizzare il servizio.'],
        ['2. Requisiti di Età', 'Il servizio è riservato esclusivamente a persone maggiorenni (18 anni compiuti). BigBet365 si riserva il diritto di richiedere documenti di identità.'],
        ['3. Account Utente', 'Ogni utente può registrare un solo account. È vietato condividere le credenziali di accesso con terzi.'],
        ['4. Scommesse', 'Le scommesse effettuate sono definitive e non rimborsabili salvo errori tecnici documentati. Le quote possono variare fino alla conferma della scommessa.'],
        ['5. Responsabilità', 'BigBet365 non è responsabile per perdite derivanti da problemi tecnici al di fuori del nostro controllo.'],
      ].map(([title, text]) => (
        <div key={title as string} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#d8e4f0', marginBottom: 8 }}>{title}</h2>
          <p style={{ fontSize: 13, color: '#6e8aaa', lineHeight: 1.8 }}>{text}</p>
        </div>
      ))}
    </div>
  );
}
