'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStoredUser } from '../lib/session';

export default function AdminNavLink() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    setIsAdmin(user?.isAdmin === true);
  }, []);

  if (!isAdmin) return null;

  return (
    <Link href="/admin" className="nav-link" style={{ color: '#f59e0b' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
      Admin
    </Link>
  );
}
