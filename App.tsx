import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScadEvaluator } from './engine/scadEvaluator';
import { PRESETS, ScadPreset } from './engine/presets';
import { EvaluationResult, CustomizerParam } from './types/scad';
import { Viewport3D } from './components/Viewport3D';
import { CodeEditor } from './components/CodeEditor';
import { CustomizerPanel } from './components/CustomizerPanel';
import { HeaderBar } from './components/HeaderBar';
import { PresetSelector } from './components/PresetSelector';
import { AiAssistantModal } from './components/AiAssistantModal';
import { injectParameters } from './engine/paramExtractor';
import { downloadProjectZip } from './utils/zipDownloader';
import { Language, TRANSLATIONS } from './utils/translations';
import { Code2, Eye, Sliders } from 'lucide-react';

export default function App() {
  const [activeLanguage, setActiveLanguage] = useState<Language>('en');
  const t = TRANSLATIONS[activeLanguage] || TRANSLATIONS.en;
  const isCs = activeLanguage === 'cs';

  // Initial code: Electronics Enclosure preset
  const [code, setCode] = useState<string>(PRESETS[0].scadCode);
  const [paramOverrides, setParamOverrides] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<'both' | 'editor' | 'preview'>('both');
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview' | 'customizer'>('preview');
  const [showCustomizer, setShowCustomizer] = useState<boolean>(true);

  // Modals
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  // Evaluator instance
  const evaluatorRef = useRef<ScadEvaluator | null>(null);
  if (!evaluatorRef.current) {
    evaluatorRef.current = new ScadEvaluator();
  }

  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Evaluate the OpenSCAD code
  const runEvaluation = useCallback(
    (codeToRun: string, overrides: Record<string, any>) => {
      if (!evaluatorRef.current) return;
      setIsEvaluating(true);

      // Execute on next tick to avoid blocking UI render
      setTimeout(() => {
        try {
          const res = evaluatorRef.current!.evaluate(codeToRun, overrides);
          setEvaluationResult(res);
        } catch (err: any) {
          console.error('Evaluation critical error:', err);
        } finally {
          setIsEvaluating(false);
        }
      }, 10);
    },
    []
  );

  // Initial evaluation on mount
  useEffect(() => {
    runEvaluation(code, paramOverrides);
  }, []);

  // Debounced auto-compilation when code changes
  useEffect(() => {
    const timer = setTimeout(() => {
      runEvaluation(code, paramOverrides);
    }, 350);
    return () => clearTimeout(timer);
  }, [code]);

  // Handle immediate parameter changes from Customizer
  const handleParamChange = (key: string, value: any) => {
    const newOverrides = { ...paramOverrides, [key]: value };
    setParamOverrides(newOverrides);
    runEvaluation(code, newOverrides);
  };

  const handleResetDefaults = () => {
    setParamOverrides({});
    runEvaluation(code, {});
  };

  const handleSelectPreset = (preset: ScadPreset) => {
    setParamOverrides({});
    setCode(preset.scadCode);
    runEvaluation(preset.scadCode, {});
  };

  const handleApplyAiCode = (newCode: string) => {
    setParamOverrides({});
    setCode(newCode);
    runEvaluation(newCode, {});
  };

  const handleNewModel = () => {
    const template = `/* [Box Dimensions] */
width = 50; // [20:1:120]
length = 40; // [20:1:120]
height = 25; // [10:1:80]
wall_thickness = 2.4; // [1.0:0.2:6.0]

/* [Appearance] */
box_color = "#38bdf8"; // [color]

color(box_color) {
  translate([0, 0, height/2]) {
    difference() {
      // Outer shell
      cube([width, length, height], center = true);

      // Inner hollow cavity
      translate([0, 0, wall_thickness])
        cube([width - 2*wall_thickness, length - 2*wall_thickness, height], center = true);
    }
  }
}
`;
    setParamOverrides({});
    setCode(template);
    runEvaluation(template, {});
  };

  const handleDownloadScad = () => {
    // If there are overrides, bake them into the downloaded code
    const finalCode = injectParameters(code, paramOverrides);
    const blob = new Blob([finalCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model_${Date.now()}.scad`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleDownloadScad();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [code, paramOverrides]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Header */}
      <HeaderBar
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenAi={() => setIsAiOpen(true)}
        onNewModel={handleNewModel}
        onDownloadScad={handleDownloadScad}
        onDownloadZip={() => downloadProjectZip()}
        activeLanguage={activeLanguage}
        onChangeLanguage={setActiveLanguage}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        showCustomizer={showCustomizer}
        onToggleCustomizer={() => setShowCustomizer((s) => !s)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Column: Code Editor */}
        <div
          className={`h-full transition-all duration-150 ${
            viewMode === 'preview'
              ? 'hidden'
              : viewMode === 'editor'
                ? 'w-full'
                : 'w-full lg:w-[42%] xl:w-[38%] shrink-0'
          } ${mobileTab === 'editor' ? 'block' : 'hidden lg:block'}`}
        >
          <CodeEditor
            code={code}
            onChange={setCode}
            onCompile={() => runEvaluation(code, paramOverrides)}
            errors={evaluationResult?.errors || []}
            activeLanguage={activeLanguage}
          />
        </div>

        {/* Center: 3D Viewport */}
        <div
          className={`flex-1 h-full min-w-0 relative ${
            viewMode === 'editor' ? 'hidden' : 'block'
          } ${mobileTab === 'preview' ? 'block' : 'hidden lg:block'}`}
        >
          <Viewport3D
            modelGroup={evaluationResult?.rootMesh || null}
            stats={evaluationResult?.stats || null}
            isEvaluating={isEvaluating}
            language={activeLanguage}
          />
        </div>

        {/* Right Column: Customizer Parameters Panel */}
        {showCustomizer && (
          <div
            className={`h-full w-full sm:w-80 lg:w-76 xl:w-80 shrink-0 ${
              mobileTab === 'customizer' ? 'block' : 'hidden lg:block'
            }`}
          >
            <CustomizerPanel
              parameters={evaluationResult?.parameters || []}
              onParamChange={handleParamChange}
              onResetDefaults={handleResetDefaults}
              activeLanguage={activeLanguage}
            />
          </div>
        )}
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="lg:hidden flex items-center justify-around h-12 bg-slate-900 border-t border-slate-800 shrink-0 z-30 select-none">
        <button
          onClick={() => setMobileTab('editor')}
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-medium transition-colors ${
            mobileTab === 'editor' ? 'text-amber-400 bg-slate-850' : 'text-slate-400'
          }`}
        >
          <Code2 className="w-4 h-4 mb-0.5" />
          <span>{t.codeEditor}</span>
        </button>

        <button
          onClick={() => setMobileTab('preview')}
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-medium transition-colors ${
            mobileTab === 'preview' ? 'text-cyan-400 bg-slate-850' : 'text-slate-400'
          }`}
        >
          <Eye className="w-4 h-4 mb-0.5" />
          <span>{t.preview3d}</span>
        </button>

        <button
          onClick={() => setMobileTab('customizer')}
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-medium transition-colors ${
            mobileTab === 'customizer' ? 'text-amber-400 bg-slate-850' : 'text-slate-400'
          }`}
        >
          <Sliders className="w-4 h-4 mb-0.5" />
          <span>{t.customizer}</span>
        </button>
      </div>

      {/* Modals */}
      <PresetSelector
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        onSelect={handleSelectPreset}
        activeLanguage={activeLanguage}
      />

      <AiAssistantModal
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        currentCode={code}
        onApplyCode={handleApplyAiCode}
        activeLanguage={activeLanguage}
      />
    </div>
  );
}
