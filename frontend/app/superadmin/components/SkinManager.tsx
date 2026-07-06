'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { motion } from 'framer-motion';
import { Palette, Image as ImageIcon, Save, RotateCcw, Eye } from 'lucide-react';

interface SkinSettings {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    accent: string;
    text: string;
    textMuted: string;
    success: string;
    warning: string;
    error: string;
  };
  logo: string;
  favicon: string;
}

const DEFAULT_SKIN: SkinSettings = {
  name: 'joverbet',
  colors: {
    primary: '#262626',
    secondary: '#14805e',
    background: '#0d0d0d',
    surface: '#1a1a1a',
    accent: '#00b4d8',
    text: '#d4e2f0',
    textMuted: '#5e7a96',
    success: '#14805e',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  logo: '/logo.png',
  favicon: '/favicon.ico',
};

const PRESET_THEMES = [
  { name: 'Joverbet', colors: DEFAULT_SKIN.colors },
  { 
    name: 'Ocean', 
    colors: {
      ...DEFAULT_SKIN.colors,
      primary: '#1e3a5f',
      secondary: '#0ea5e9',
      accent: '#22d3ee',
    }
  },
  { 
    name: 'Royal', 
    colors: {
      ...DEFAULT_SKIN.colors,
      primary: '#4c1d95',
      secondary: '#a855f7',
      accent: '#d8b4fe',
    }
  },
  { 
    name: 'Fire', 
    colors: {
      ...DEFAULT_SKIN.colors,
      primary: '#7c2d12',
      secondary: '#f97316',
      accent: '#fdba74',
    }
  },
];

export default function SkinManager() {
  const [skin, setSkin] = useState<SkinSettings>(DEFAULT_SKIN);
  const [activeColor, setActiveColor] = useState<keyof SkinSettings['colors']>('primary');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const updateColor = useCallback((color: string) => {
    setSkin(prev => ({
      ...prev,
      colors: { ...prev.colors, [activeColor]: color }
    }));
  }, [activeColor]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/superadmin/skin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skin),
      });
      if (!res.ok) throw new Error('Failed to save');
      alert('Tema salvato con successo!');
    } catch (e) {
      alert('Errore nel salvare il tema');
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (preset: typeof PRESET_THEMES[0]) => {
    setSkin(prev => ({ ...prev, colors: preset.colors }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Gestione Tema
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setSkin(DEFAULT_SKIN)}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              previewMode ? 'bg-[#14805e] text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#14805e] text-white rounded-lg hover:bg-[#1a9c70] transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvataggio...' : 'Salva Tema'}
          </button>
        </div>
      </div>

      {/* Preset Themes */}
      <div className="bg-white/5 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">Temi Predefiniti</h3>
        <div className="flex gap-3">
          {PRESET_THEMES.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div 
                className="w-12 h-12 rounded-lg"
                style={{ background: preset.colors.primary }}
              />
              <span className="text-xs text-gray-400">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Color Editor */}
        <div className="space-y-4">
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-4">Colori</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(Object.keys(skin.colors) as Array<keyof SkinSettings['colors']>).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveColor(key);
                    setShowPicker(true);
                  }}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg transition-colors
                    ${activeColor === key ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'}
                  `}
                >
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: skin.colors[key] }}
                  />
                  <div className="text-left">
                    <p className="text-sm text-white capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="text-xs text-gray-400">{skin.colors[key]}</p>
                  </div>
                </button>
              ))}
            </div>

            {showPicker && (
              <div className="bg-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white capitalize">
                    {activeColor.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <button 
                    onClick={() => setShowPicker(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <HexColorPicker 
                  color={skin.colors[activeColor]} 
                  onChange={updateColor}
                  className="w-full"
                />
                <input
                  type="text"
                  value={skin.colors[activeColor]}
                  onChange={(e) => updateColor(e.target.value)}
                  className="w-full mt-3 px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm"
                />
              </div>
            )}
          </div>

          {/* Logo Upload */}
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Logo
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-24 h-16 bg-white/10 rounded-lg flex items-center justify-center">
                {skin.logo ? (
                  <img src={skin.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-gray-400">Nessun logo</span>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={skin.logo}
                  onChange={(e) => setSkin(prev => ({ ...prev, logo: e.target.value }))}
                  placeholder="URL logo..."
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm mb-2"
                />
                <p className="text-xs text-gray-400">Formato consigliato: PNG con trasparenza, 200x50px</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-4">Anteprima Live</h3>
          
          <div 
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: skin.colors.background }}
          >
            {/* Header Preview */}
            <div 
              className="px-4 py-3 flex items-center justify-between"
              style={{ backgroundColor: skin.colors.primary }}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: skin.colors.secondary }}
                />
                <span style={{ color: skin.colors.text }}>Logo</span>
              </div>
              <div className="flex items-center gap-2">
                <span 
                  className="px-2 py-1 rounded text-xs"
                  style={{ backgroundColor: skin.colors.surface, color: skin.colors.text }}
                >
                  Login
                </span>
              </div>
            </div>

            {/* Content Preview */}
            <div className="p-4 space-y-3">
              <div 
                className="p-3 rounded-lg"
                style={{ backgroundColor: skin.colors.surface }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: skin.colors.text }}>Evento di esempio</span>
                  <span 
                    className="px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: skin.colors.accent, color: skin.colors.background }}
                  >
                    Live
                  </span>
                </div>
                <div className="flex gap-2">
                  {['1.85', '3.40', '4.20'].map((odd, i) => (
                    <button
                      key={i}
                      className="flex-1 py-2 rounded text-sm font-bold"
                      style={{ 
                        backgroundColor: skin.colors.secondary,
                        color: '#fff'
                      }}
                    >
                      {odd}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coupon Preview */}
              <div 
                className="p-3 rounded-lg"
                style={{ backgroundColor: skin.colors.surface }}
              >
                <p style={{ color: skin.colors.textMuted }} className="text-xs mb-2">Coupon (2 selezioni)</p>
                <div 
                  className="py-2 px-3 rounded text-center font-bold"
                  style={{ 
                    backgroundColor: skin.colors.secondary,
                    color: '#fff'
                  }}
                >
                  SCOMMETTI €10.00
                </div>
              </div>
            </div>

            {/* Footer Preview */}
            <div 
              className="px-4 py-2 text-center text-xs"
              style={{ 
                backgroundColor: skin.colors.surface,
                color: skin.colors.textMuted
              }}
            >
              © 2024 Sportsbook - 18+ Gioca responsabilmente
            </div>
          </div>

          {/* CSS Export */}
          <div className="mt-4">
            <h4 className="text-xs font-bold text-gray-400 mb-2">CSS Variables</h4>
            <pre 
              className="p-3 rounded-lg text-xs overflow-x-auto"
              style={{ backgroundColor: skin.colors.surface }}
            >
              <code style={{ color: skin.colors.text }}>
                {`:root {${Object.entries(skin.colors).map(([k, v]) => `
  --color-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v};`).join('')}
}`}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
