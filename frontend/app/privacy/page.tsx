export default function Privacy() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#d8e4f0', marginBottom: 8 }}>Privacy Policy</h1>
      <div style={{ width: 40, height: 2, background: '#00b4d8', marginBottom: 28 }} />
      <p style={{ fontSize: 13, color: '#6e8aaa', lineHeight: 1.8, marginBottom: 16 }}>
        Ultimo aggiornamento: Gennaio 2025
      </p>
      {[
        ['Dati Raccolti', 'Raccogliamo dati di registrazione (username), dati di utilizzo del servizio e informazioni sulle scommesse effettuate.'],
        ['Utilizzo dei Dati', 'I dati vengono utilizzati esclusivamente per erogare il servizio, prevenire frodi e adempiere agli obblighi di legge.'],
        ['Conservazione', 'I dati vengono conservati per il periodo necessario all\'erogazione del servizio e per gli obblighi fiscali e legali applicabili.'],
        ['Diritti dell\'Utente', 'Hai il diritto di accedere, rettificare o cancellare i tuoi dati personali. Contattaci all\'indirizzo privacy@bigbet365.it.'],
      ].map(([title, text]) => (
        <div key={title as string} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#d8e4f0', marginBottom: 8 }}>{title}</h2>
          <p style={{ fontSize: 13, color: '#6e8aaa', lineHeight: 1.8 }}>{text}</p>
        </div>
      ))}
    </div>
  );
}
