import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Layers,
  Sparkles,
  Download,
  FilePlus,
  Globe,
  Sliders,
  Code2,
  Columns,
  Eye,
  FolderArchive,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Language, TRANSLATIONS } from '../utils/translations';

interface HeaderBarProps {
  onOpenPresets: () => void;
  onOpenAi: () => void;
  onNewModel: () => void;
  onDownloadScad: () => void;
  onDownloadZip: () => void;
  activeLanguage: Language;
  onChangeLanguage: (lang: Language) => void;
  viewMode: 'both' | 'editor' | 'preview';
  onChangeViewMode: (mode: 'both' | 'editor' | 'preview') => void;
  showCustomizer: boolean;
  onToggleCustomizer: () => void;
}

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'cs', label: 'Čeština', flag: '🇨🇿' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
];

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onOpenPresets,
  onOpenAi,
  onNewModel,
  onDownloadScad,
  onDownloadZip,
  activeLanguage,
  onChangeLanguage,
  viewMode,
  onChangeViewMode,
  showCustomizer,
  onToggleCustomizer,
}) => {
  const t = TRANSLATIONS[activeLanguage] || TRANSLATIONS.en;
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close language menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLangObj = LANGUAGES.find((l) => l.code === activeLanguage) || LANGUAGES[0];

  return (
    <header className="h-13 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3.5 select-none shrink-0 z-20">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/20">
            <Box className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">
                {t.appName}
              </h1>
              <span className="text-[10px] text-amber-400/90 font-mono">v1.2</span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-1 hidden md:block" />

        {/* Action Buttons: Presets & AI */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenPresets}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-slate-700/80 transition-colors shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.presets}</span>
          </button>

          <button
            onClick={onOpenAi}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 text-amber-300 hover:text-amber-200 rounded-lg text-xs font-semibold border border-amber-500/30 transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.aiAssistant}</span>
          </button>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* View Mode Switcher (Desktop) */}
        <div className="hidden lg:flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
          <button
            onClick={() => onChangeViewMode('editor')}
            title={t.codeEditor}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'editor' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeViewMode('both')}
            title="Split view"
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'both' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeViewMode('preview')}
            title={t.preview3d}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'preview' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toggle Customizer Sidebar */}
        <button
          onClick={onToggleCustomizer}
          title={t.parametersTitle}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            showCustomizer
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              : 'bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-750'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.customizer}</span>
        </button>

        {/* Download .scad */}
        <button
          onClick={onDownloadScad}
          title={t.downloadScad}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Export Project ZIP for GitHub */}
        <button
          onClick={onDownloadZip}
          title={t.exportZipTitle}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-slate-700/80 transition-colors shadow-xs"
        >
          <FolderArchive className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">{t.exportZip}</span>
        </button>

        {/* New Model */}
        <button
          onClick={onNewModel}
          title={t.newModel}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
        >
          <FilePlus className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-800 mx-0.5" />

        {/* Multi-Language Dropdown */}
        <div className="relative" ref={langMenuRef}>
          <button
            onClick={() => setLangMenuOpen((v) => !v)}
            title="Language / Jazyk / Sprache / Idioma / Langue / 言語"
            className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700/80 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs">{currentLangObj.flag}</span>
            <span className="uppercase text-[11px] font-mono font-semibold">{currentLangObj.code}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>

          {langMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-40 bg-slate-900 border border-slate-750 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider text-slate-400 border-b border-slate-800">
                Language / Jazyk
              </div>
              {LANGUAGES.map((lang) => {
                const isSelected = lang.code === activeLanguage;
                return (
                  <button
                    key={lang.code}
                    onClick={() => {
                      onChangeLanguage(lang.code);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                      isSelected
                        ? 'bg-amber-500/15 text-amber-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
