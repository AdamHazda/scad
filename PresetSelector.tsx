import React from 'react';
import { PRESETS, ScadPreset } from '../engine/presets';
import { X, Sparkles, Box, Cog, Smartphone, Cylinder, Package, Layers } from 'lucide-react';
import { Language, TRANSLATIONS } from '../utils/translations';

interface PresetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (preset: ScadPreset) => void;
  activeLanguage: Language;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  activeLanguage,
}) => {
  if (!isOpen) return null;
  const isCs = activeLanguage === 'cs';
  const t = TRANSLATIONS[activeLanguage] || TRANSLATIONS.en;

  const getPresetIcon = (id: string) => {
    switch (id) {
      case 'organizer':
        return <Package className="w-5 h-5 text-sky-400" />;
      case 'gear':
        return <Cog className="w-5 h-5 text-amber-400" />;
      case 'phone-stand':
        return <Smartphone className="w-5 h-5 text-emerald-400" />;
      case 'flange':
        return <Cylinder className="w-5 h-5 text-slate-400" />;
      case 'twisted-vase':
        return <Sparkles className="w-5 h-5 text-pink-400" />;
      default:
        return <Box className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>{t.presets}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isCs
                ? 'Vyberte si předpřipravený model pro 3D tisk a upravte jeho rozměry v Customizeru'
                : 'Select a ready-to-print 3D model and customize dimensions in the parameter panel'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preset Cards Grid */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {PRESETS.map((preset) => (
            <div
              key={preset.id}
              onClick={() => {
                onSelect(preset);
                onClose();
              }}
              className="group p-4 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 hover:border-amber-500/50 rounded-xl cursor-pointer transition-all duration-150 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg group-hover:scale-105 transition-transform">
                    {getPresetIcon(preset.id)}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {preset.category}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-200 group-hover:text-amber-300 transition-colors">
                  {isCs ? preset.title : preset.titleEn}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
                  {isCs ? preset.description : preset.descriptionEn}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                <span>OpenSCAD .scad</span>
                <span className="text-amber-400 font-medium group-hover:translate-x-0.5 transition-transform">
                  {isCs ? 'Načíst model →' : 'Load model →'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
