import React from 'react';
import { CustomizerParam } from '../types/scad';
import { Sliders, RotateCcw, ChevronDown, ChevronRight, Hash, ToggleLeft, Palette } from 'lucide-react';
import { Language, TRANSLATIONS, localizeGroupName, localizeParamName } from '../utils/translations';

interface CustomizerPanelProps {
  parameters: CustomizerParam[];
  onParamChange: (key: string, value: any) => void;
  onResetDefaults: () => void;
  activeLanguage: Language;
}

export const CustomizerPanel: React.FC<CustomizerPanelProps> = ({
  parameters,
  onParamChange,
  onResetDefaults,
  activeLanguage,
}) => {
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});
  const t = TRANSLATIONS[activeLanguage] || TRANSLATIONS.en;

  // Group parameters by their section/group
  const groups: Record<string, CustomizerParam[]> = {};
  parameters.forEach((param) => {
    const g = param.group || t.mainParams;
    if (!groups[g]) groups[g] = [];
    groups[g].push(param);
  });

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  if (parameters.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 text-sm">
        <Sliders className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
        <p className="font-medium text-slate-400">
          {t.noParamsTitle}
        </p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          {t.noParamsDesc}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-semibold text-slate-200 tracking-wider uppercase">
            {t.parametersTitle}
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">({parameters.length})</span>
        </div>
        <button
          onClick={onResetDefaults}
          title={t.resetDefaults}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-md transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{t.resetDefaults}</span>
        </button>
      </div>

      {/* Parameter Groups */}
      <div className="p-3 space-y-4">
        {Object.entries(groups).map(([groupName, params]) => {
          const isCollapsed = collapsedGroups[groupName];
          const localizedGroupName = localizeGroupName(groupName, activeLanguage);
          return (
            <div
              key={groupName}
              className="border border-slate-800 rounded-lg bg-slate-950/40 overflow-hidden"
            >
              {/* Group Accordion Header */}
              <button
                onClick={() => toggleGroup(groupName)}
                className="w-full flex items-center justify-between px-3 py-2 text-left bg-slate-800/40 hover:bg-slate-800/70 text-slate-300 font-medium text-xs transition-colors"
              >
                <span className="text-slate-200 font-semibold">{localizedGroupName}</span>
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>

              {/* Group Body */}
              {!isCollapsed && (
                <div className="p-3 space-y-3.5">
                  {params.map((param) => {
                    const localizedName = localizeParamName(param.name, param.key, activeLanguage);
                    return (
                      <div key={param.key} className="space-y-1.5">
                        {/* Label & Value display */}
                        <div className="flex items-center justify-between text-xs">
                          <label
                            htmlFor={`param-${param.key}`}
                            className="text-slate-300 font-medium truncate max-w-[170px]"
                            title={localizedName}
                          >
                            {localizedName}
                          </label>
                        <span className="font-mono text-[11px] text-amber-400 font-semibold">
                          {typeof param.value === 'boolean'
                            ? param.value
                              ? t.on
                              : t.off
                            : typeof param.value === 'number'
                              ? Number.isInteger(param.value)
                                ? param.value
                                : param.value.toFixed(1)
                              : String(param.value)}
                        </span>
                      </div>

                      {/* Control according to type */}
                      {param.type === 'number' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            id={`param-${param.key}`}
                            min={param.min !== undefined ? param.min : 0}
                            max={param.max !== undefined ? param.max : 100}
                            step={param.step !== undefined ? param.step : 1}
                            value={param.value ?? 0}
                            onChange={(e) => onParamChange(param.key, Number(e.target.value))}
                            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                          />
                          <input
                            type="number"
                            min={param.min}
                            max={param.max}
                            step={param.step || 1}
                            value={param.value ?? 0}
                            onChange={(e) => onParamChange(param.key, Number(e.target.value))}
                            className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-xs text-slate-200 focus:outline-hidden focus:border-amber-400"
                          />
                        </div>
                      )}

                      {param.type === 'boolean' && (
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-[11px] text-slate-500 font-mono">
                            {param.key}
                          </span>
                          <button
                            type="button"
                            onClick={() => onParamChange(param.key, !param.value)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              param.value ? 'bg-amber-500' : 'bg-slate-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow-md ring-0 transition duration-200 ease-in-out ${
                                param.value ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      )}

                      {param.type === 'select' && param.options && (
                        <select
                          id={`param-${param.key}`}
                          value={param.value}
                          onChange={(e) => onParamChange(param.key, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 font-medium focus:outline-hidden focus:border-amber-400"
                        >
                          {param.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {param.type === 'color' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id={`param-${param.key}`}
                            value={typeof param.value === 'string' && param.value.startsWith('#') ? param.value : '#fcd34d'}
                            onChange={(e) => onParamChange(param.key, e.target.value)}
                            className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                          />
                          <input
                            type="text"
                            value={String(param.value)}
                            onChange={(e) => onParamChange(param.key, e.target.value)}
                            className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-200 focus:outline-hidden focus:border-amber-400"
                          />
                        </div>
                      )}

                      {param.type === 'string' && (
                        <input
                          type="text"
                          id={`param-${param.key}`}
                          value={String(param.value ?? '')}
                          onChange={(e) => onParamChange(param.key, e.target.value)}
                          className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-hidden focus:border-amber-400"
                        />
                      )}

                      {param.description && (
                        <p className="text-[10px] text-slate-500">{param.description}</p>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
