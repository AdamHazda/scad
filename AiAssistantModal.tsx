import React, { useState } from 'react';
import { X, Sparkles, Wand2, ArrowRight, Check, AlertCircle, Key, ChevronDown, ChevronUp } from 'lucide-react';
import { Language, TRANSLATIONS } from '../utils/translations';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCode: string;
  onApplyCode: (newCode: string) => void;
  activeLanguage: Language;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  currentCode,
  onApplyCode,
  activeLanguage,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultCode, setResultCode] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;
  const t = TRANSLATIONS[activeLanguage] || TRANSLATIONS.en;
  const isCs = activeLanguage === 'cs';

  const samplePromptsCs = [
    'Vytvoř držák na zeď na 3 kabely se zapuštěnými otvory pro šrouby.',
    'Vytvoř krabičku na elektroniku s posuvným víčkem a vodicími drážkami.',
    'Přidej k mému aktuálnímu kódu parametry pro Customizer a posuvníky.',
    'Vytvoř modulární šestihranný organizér na stůl (honeycomb).',
  ];

  const samplePromptsEn = [
    'Create a wall mount bracket for 3 cables with countersunk screw holes.',
    'Create a sliding lid container box with guide grooves.',
    'Add Customizer parameters and slider annotations to my current code.',
    'Create a modular hexagonal honeycomb desk organizer.',
  ];

  const samplePrompts = isCs ? samplePromptsCs : samplePromptsEn;

  const [clientApiKey, setClientApiKey] = useState(
    () => localStorage.getItem('gemini_api_key') || ''
  );
  const [showKeyInput, setShowKeyInput] = useState(false);

  const handleSaveApiKey = (key: string) => {
    setClientApiKey(key);
    if (key.trim()) {
      localStorage.setItem('gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  };

  const handleGenerate = async (mode: 'generate' | 'edit' | 'add_customizer' = 'generate') => {
    if (!prompt.trim() && mode !== 'add_customizer') return;

    setLoading(true);
    setError(null);
    setResultCode(null);
    setExplanation(null);

    try {
      let data: any = null;
      let usedDirect = false;

      try {
        const res = await fetch('/api/gemini/scad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            currentCode,
            mode,
            clientApiKey: clientApiKey.trim() || undefined,
          }),
        });

        if (res.status === 404 && clientApiKey.trim()) {
          usedDirect = true;
        } else {
          data = await res.json();
          if (!res.ok) {
            let msg = data.error || 'Generation failed';
            try {
              const parsed = JSON.parse(msg);
              if (parsed?.error?.message) msg = parsed.error.message;
            } catch {}
            throw new Error(msg);
          }
        }
      } catch (fetchErr: any) {
        if (clientApiKey.trim()) {
          usedDirect = true;
        } else {
          throw fetchErr;
        }
      }

      if (usedDirect) {
        // Direct call to Gemini REST API for static GitHub Pages hosting
        const directRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
            clientApiKey.trim()
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${mode === 'generate' ? 'Generate model' : 'Edit code'}: ${prompt}\nCurrent code:\n${currentCode}` }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.3,
              },
              systemInstruction: {
                parts: [
                  {
                    text:
                      'You are an expert OpenSCAD 3D parametric CAD designer. Return valid JSON with {"scad": "string", "explanation": "string"}. Define customizable parameters at the top with Customizer comments /* [Section] */ and sliders [min:step:max]. Keep model on print bed (Z >= 0).',
                  },
                ],
              },
            }),
          }
        );
        const directJson = await directRes.json();
        if (!directRes.ok) {
          throw new Error(directJson.error?.message || 'Gemini API direct call failed');
        }
        let txt = directJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        txt = txt.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        let parsed: any = {};
        try {
          parsed = JSON.parse(txt);
        } catch {
          parsed = { scad: txt, explanation: 'Model generated.' };
        }
        data = {
          scadCode: parsed.scad || '',
          explanation: parsed.explanation || 'Model generated successfully.',
        };
      }

      setResultCode(data.scadCode);
      setExplanation(data.explanation);
    } catch (err: any) {
      setError(err.message || 'Error communicating with AI model.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (resultCode) {
      onApplyCode(resultCode);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                {isCs ? 'AI Asistent pro OpenSCAD' : 'OpenSCAD AI Assistant'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isCs
                  ? 'Zadejte popis v přirozené řeči a nechte Gemini vytvořit parametrický kód'
                  : 'Describe what you want to build and let Gemini write parametric code'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              {isCs ? 'Co si přejete vytvořit nebo upravit?' : 'What would you like to build or edit?'}
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                isCs
                  ? 'Např.: Vytvoř parametrickou krabičku na tužky se 4 přihrádkami a zaoblenými hranami...'
                  : 'E.g.: Create a parametric pencil organizer box with 4 compartments...'
              }
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-amber-400 leading-relaxed resize-none"
            />
          </div>

          {/* Quick Prompts */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-500 font-medium">
              {isCs ? 'Rychlé nápady:' : 'Quick Prompts:'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {samplePrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(p)}
                  className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-amber-300 rounded-md transition-colors text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => handleGenerate('generate')}
              disabled={loading || !prompt.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>{isCs ? 'Generování kódu...' : 'Generating code...'}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{isCs ? 'Vygenerovat nový model' : 'Generate Model'}</span>
                </>
              )}
            </button>

            {currentCode.trim().length > 10 && (
              <button
                onClick={() => handleGenerate('add_customizer')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <span>{isCs ? '+ Parametry k aktuálnímu kódu' : '+ Add Customizer params'}</span>
              </button>
            )}
          </div>

          {/* Optional API Key for Static Hosting */}
          <div className="pt-1">
            <button
              onClick={() => setShowKeyInput((v) => !v)}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showKeyInput
                ? isCs
                  ? '▲ Skrýt nastavení API klíče'
                  : '▲ Hide API Key Settings'
                : isCs
                  ? '▼ Vlastní Gemini API klíč (pro statický hosting)'
                  : '▼ Custom Gemini API Key (for static hosting)'}
            </button>
            {showKeyInput && (
              <div className="mt-2 p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                <p className="text-[10px] text-slate-400">
                  {isCs
                    ? 'Pokud aplikaci hostujete staticky (např. na GitHub Pages), zadejte sem svůj bezplatný klíč z Google AI Studio (uloží se v prohlížeči).'
                    : 'If hosting statically without a backend, enter your free Gemini API key here (saved locally in your browser).'}
                </p>
                <input
                  type="password"
                  value={clientApiKey}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-hidden focus:border-amber-400"
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{isCs ? 'Chyba při volání AI' : 'AI Error'}</p>
                <p className="mt-0.5 text-rose-300">{error}</p>
              </div>
            </div>
          )}

          {/* Generated Result Preview */}
          {resultCode && (
            <div className="space-y-3 pt-3 border-t border-slate-800">
              {explanation && (
                <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-xs text-amber-200">
                  <p className="font-semibold text-amber-300 mb-0.5">
                    {isCs ? 'Vysvětlení modelu:' : 'Model Explanation:'}
                  </p>
                  <p className="text-slate-300">{explanation}</p>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{isCs ? 'Vygenerovaný SCAD kód:' : 'Generated SCAD code:'}</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {resultCode.split('\n').length} {isCs ? 'řádků' : 'lines'}
                  </span>
                </div>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre">
                  {resultCode}
                </pre>
              </div>

              <button
                onClick={handleApply}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isCs ? 'Použít kód v editoru a zobrazit 3D náhled' : 'Apply code to editor & 3D view'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
