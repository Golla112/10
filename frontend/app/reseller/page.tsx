'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, Users, ArrowLeftRight, FileText,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getStoredUser } from '../../lib/session';
import ResellerDashboard from './components/ResellerDashboard';

// Placeholder components for other tabs
function ResellerUsers() {
  return (
    <div className="p-8 text-center">
      <h3 className="text-xl font-bold text-white mb-2">Gestione Utenti</h3>
      <p className="text-gray-400">Funzionalità in sviluppo - Integrazione completa prossimamente</p>
    </div>
  );
}

function TransferHistory() {
  return (
    <div className="p-8 text-center">
      <h3 className="text-xl font-bold text-white mb-2">Storico Trasferimenti</h3>
      <p className="text-gray-400">Funzionalità in sviluppo - Integrazione completa prossimamente</p>
    </div>
  );
}

function ResellerReports() {
  return (
    <div className="p-8 text-center">
      <h3 className="text-xl font-bold text-white mb-2">Reportistica</h3>
      <p className="text-gray-400">Funzionalità in sviluppo - Integrazione completa prossimamente</p>
    </div>
  );
}

type ResellerTab = 'dashboard' | 'users' | 'transfers' | 'reports';

const TABS: { key: ResellerTab; label: string; Icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'users', label: 'Utenti', Icon: Users },
  { key: 'transfers', label: 'Trasferimenti', Icon: ArrowLeftRight },
  { key: 'reports', label: 'Report', Icon: FileText },
];

function ResellerPanel() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ResellerTab>('dashboard');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check URL param for tab
    const tab = searchParams.get('tab') as ResellerTab;
    if (tab && TABS.some(t => t.key === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  if (!mounted) return null;

  const user = getStoredUser();
  if (!user || user.role !== 'reseller') {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-4">
        <div className="text-4xl">🔒</div>
        <p className="text-lg font-bold text-white">Accesso riservato ai reseller</p>
        <p className="text-sm text-gray-400">Effettua il login con credenziali reseller</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-[#e2e8f0]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="Logo" width={120} height={40} className="object-contain" priority />
            <div className="h-8 w-px bg-white/20" />
            <div>
              <h1 className="text-xl font-bold text-white">Reseller Panel</h1>
              <p className="text-xs text-gray-400">Gestione network utenti</p>
            </div>
          </div>
          <Link 
            href="/" 
            className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Home
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 p-2 bg-white/5 rounded-xl">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg
                text-sm font-medium transition-all
                ${activeTab === key
                  ? 'bg-[#14805e] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white/5 rounded-xl p-6">
          {activeTab === 'dashboard' && <ResellerDashboard />}
          {activeTab === 'users' && <ResellerUsers />}
          {activeTab === 'transfers' && <TransferHistory />}
          {activeTab === 'reports' && <ResellerReports />}
        </div>
      </div>
    </div>
  );
}

export default function ResellerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#14805e]" />
      </div>
    }>
      <ResellerPanel />
    </Suspense>
  );
}
