export default function Cookie() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#d8e4f0', marginBottom: 8 }}>Cookie Policy</h1>
      <div style={{ width: 40, height: 2, background: '#00b4d8', marginBottom: 28 }} />
      <p style={{ fontSize: 13, color: '#6e8aaa', lineHeight: 1.8, marginBottom: 24 }}>
        BigBet365 utilizza cookie tecnici necessari al funzionamento del sito e cookie analitici per migliorare l&apos;esperienza utente.
      </p>
      {[
        ['Cookie Tecnici', 'Necessari per il funzionamento del sito. Non possono essere disabilitati. Includono cookie di sessione e autenticazione.'],
        ['Cookie Analitici', 'Utilizzati per analizzare il traffico in forma anonima. Possono essere disabilitati senza compromettere la funzionalità del sito.'],
        ['Gestione Cookie', 'Puoi gestire le preferenze cookie dalle impostazioni del tuo browser. La disabilitazione dei cookie tecnici potrebbe compromettere alcune funzionalità.'],
      ].map(([title, text]) => (
        <div key={title as string} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#d8e4f0', marginBottom: 8 }}>{title}</h2>
          <p style={{ fontSize: 13, color: '#6e8aaa', lineHeight: 1.8 }}>{text}</p>
        </div>
      ))}
    </div>
  );
}
