'use client';

import { useState } from 'react';
import CasinoGames from '../../components/CasinoGames';
import BannerCarousel from '../../components/BannerCarousel';

const categories = [
  { id: 'all', label: 'Tutti', icon: '🎮' },
  { id: 'slots', label: 'Slot', icon: '🎰' },
  { id: 'table', label: 'Tavoli', icon: '🎲' },
  { id: 'jackpot', label: 'Jackpot', icon: '💰' },
];

export default function CasinoPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<'casino' | 'live'>('casino');

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">
          {activeTab === 'casino' ? '🎰 Casino' : '🎲 Live Casino'}
        </h1>
        
        {/* Tab Switcher */}
        <div className="flex bg-white/10 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('casino')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'casino'
                ? 'bg-[#14805e] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Casino
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'live'
                ? 'bg-[#14805e] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Live
          </button>
        </div>
      </div>

      {/* Banner */}
      <BannerCarousel />

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeCategory === cat.id
                ? 'bg-[#14805e] text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Games Grid */}
      <CasinoGames 
        variant={activeTab} 
        limit={activeTab === 'casino' ? 12 : 8} 
      />

      {/* Promotions Section */}
      <div className="bg-gradient-to-r from-[#14805e]/20 to-[#00b4d8]/20 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-2">🎁 Promozioni Casino</h2>
        <p className="text-gray-400 mb-4">
          Scopri le nostre offerte esclusive per i giochi da casino. 
          Bonus di benvenuto fino a €500 per i nuovi giocatori!
        </p>
        <button className="bg-[#14805e] hover:bg-[#1a9c70] text-white font-bold px-6 py-3 rounded-lg transition-colors">
          Scopri di più
        </button>
      </div>
    </div>
  );
}
