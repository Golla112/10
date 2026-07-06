'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QRCodeImage({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 128,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setDataUrl).catch(console.error);
  }, [url]);

  if (!dataUrl) return null;

  return (
    <div style={{ textAlign: 'center', margin: '10px 0' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="QR verifica schedina" width={128} height={128} style={{ display: 'inline-block' }} />
      <div style={{ fontSize: '9px', color: '#888', marginTop: '4px' }}>Scansiona per verificare</div>
    </div>
  );
}
