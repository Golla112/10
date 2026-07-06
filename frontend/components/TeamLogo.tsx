'use client';
import { useState } from 'react';
import { getTeamLogoUrl } from '../lib/teamLogos';

interface TeamLogoProps {
  name: string;
  size?: number;
  borderRadius?: number;
}

function avatarColor(name: string): string {
  const colors = [
    'linear-gradient(135deg,#1d4ed8,#3b82f6)',
    'linear-gradient(135deg,#065f46,#10b981)',
    'linear-gradient(135deg,#7c3aed,#a78bfa)',
    'linear-gradient(135deg,#b45309,#f59e0b)',
    'linear-gradient(135deg,#be123c,#f43f5e)',
    'linear-gradient(135deg,#0e7490,#22d3ee)',
    'linear-gradient(135deg,#374151,#6b7280)',
    'linear-gradient(135deg,#1e3a5f,#2563eb)',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}

export default function TeamLogo({ name, size = 44, borderRadius = 10 }: TeamLogoProps) {
  const logoUrl = getTeamLogoUrl(name);
  const [imgError, setImgError] = useState(false);

  const base: React.CSSProperties = {
    width: size, height: size, borderRadius, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  };

  if (logoUrl && !imgError) {
    return (
      <div style={{ ...base, background: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: 2 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div style={{ ...base, background: avatarColor(name) }}>
      <span style={{ fontSize: Math.round(size * 0.38), fontWeight: 900, color: '#fff' }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
