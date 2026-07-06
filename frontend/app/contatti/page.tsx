export default function Contatti() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#d8e4f0', marginBottom: 8 }}>Contattaci</h1>
      <div style={{ width: 40, height: 2, background: '#00b4d8', marginBottom: 32 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        {[
          { icon: '📧', title: 'Email Supporto', value: 'supporto@bigbet365.it' },
          { icon: '🔒', title: 'Privacy', value: 'privacy@bigbet365.it' },
          { icon: '⚖️', title: 'Legale', value: 'legale@bigbet365.it' },
          { icon: '🕐', title: 'Orari Supporto', value: 'Lun–Ven 9:00–18:00' },
        ].map(item => (
          <div key={item.title} style={{
            background: '#0d1220', border: '1px solid #1a2030', borderRadius: 10, padding: '20px',
          }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>{item.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6e8aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{item.title}</div>
            <div style={{ fontSize: 13, color: '#d8e4f0', fontWeight: 600 }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{
        background: 'rgba(0,180,216,0.05)', border: '1px solid rgba(0,180,216,0.15)',
        borderRadius: 10, padding: '20px 24px',
        fontSize: 12, color: '#6e8aaa', lineHeight: 1.7,
      }}>
        <strong style={{ color: '#00b4d8' }}>Sede Legale:</strong> Via Roma 1, 00100 Roma (RM) — P.IVA 12345678901
      </div>
    </div>
  );
}
