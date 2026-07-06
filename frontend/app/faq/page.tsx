export default function FAQ() {
  const items = [
    ['Come mi registro?', 'Clicca su "Registrati" in alto a destra, inserisci username e password. La registrazione è gratuita e immediata.'],
    ['Come verifico una schedina?', 'Vai su "Verifica" nel menu principale e inserisci il codice schedina ricevuto al momento della scommessa.'],
    ['Quali sport sono disponibili?', 'Offriamo scommesse su calcio (Serie A, Premier League, La Liga, Bundesliga, Ligue 1, Champions League e molti altri), con nuovi sport in arrivo.'],
    ['Come funzionano le quote?', 'Le quote rappresentano il moltiplicatore della tua puntata in caso di vincita. Una quota di 2.50 su una puntata di €10 ti dà €25 in caso di vincita.'],
    ['Posso cancellare una scommessa?', 'Le scommesse non possono essere cancellate una volta confermate, salvo errori tecnici documentati.'],
    ['Come contatto il supporto?', 'Puoi contattarci tramite la pagina Contatti o scrivere a supporto@bigbet365.it.'],
  ];
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#d8e4f0', marginBottom: 8 }}>FAQ</h1>
      <div style={{ width: 40, height: 2, background: '#00b4d8', marginBottom: 32 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map(([q, a]) => (
          <div key={q} style={{
            background: '#0d1220', border: '1px solid #1a2030', borderRadius: 10, padding: '18px 20px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#d8e4f0', marginBottom: 8 }}>{q}</div>
            <div style={{ fontSize: 12, color: '#6e8aaa', lineHeight: 1.7 }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
