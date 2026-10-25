import React, { useRef, useState } from 'react';
import { ScadError } from '../types/scad';
import { Play, Copy, Check, Upload, Plus, Code2, AlertTriangle, FileCode } from 'lucide-react';
import { Language, TRANSLATIONS } from '../utils/translations';

interface CodeEditorProps {
  code: string;
  onChange: (val: string) => void;
  onCompile: () => void;
  errors: ScadError[];
  activeLanguage: Language;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  onCompile,
  errors,
  activeLanguage,
}) => {
  const t = TRANSLATIONS[activeLanguage] || TRANSLATIONS.en;
  const isCs = activeLanguage === 'cs';
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const lines = code.split('\n');

  // Insert snippet at current cursor position
  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newCode = code.slice(0, start) + snippet + code.slice(end);
    onChange(newCode);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 10);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onChange(content);
        onCompile();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // F5 or Ctrl+Enter / Cmd+Enter to compile
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
      e.preventDefault();
      onCompile();
      return;
    }

    // Tab key inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newCode = code.slice(0, start) + '  ' + code.slice(end);
      onChange(newCode);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800">
      {/* Editor Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs select-none">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-200">
            OpenSCAD Editor
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {lines.length} {t.lines}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* File Upload .scad */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".scad,.txt"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title={t.openFile}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.openFile}</span>
          </button>

          {/* Copy Code */}
          <button
            onClick={handleCopy}
            title={t.copy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? t.copied : t.copy}</span>
          </button>

          {/* Re-Evaluate / Compile Button */}
          <button
            onClick={onCompile}
            title={t.renderF5}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-md shadow-sm transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{t.renderF5}</span>
          </button>
        </div>
      </div>

      {/* Snippet Quick Insertion Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-900/30 border-b border-slate-800/80 overflow-x-auto text-[11px] scrollbar-none select-none">
        <span className="text-slate-500 text-[10px] uppercase font-mono mr-1">
          {isCs ? 'Vložit:' : 'Snippets:'}
        </span>
        <button
          onClick={() => insertSnippet('cube([20, 20, 20], center = true);\n')}
          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[11px] transition-colors"
        >
          cube()
        </button>
        <button
          onClick={() => insertSnippet('cylinder(h = 30, r = 8, center = true, $fn = 32);\n')}
          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[11px] transition-colors"
        >
          cylinder()
        </button>
        <button
          onClick={() => insertSnippet('sphere(r = 10, $fn = 32);\n')}
          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[11px] transition-colors"
        >
          sphere()
        </button>
        <button
          onClick={() => insertSnippet('difference() {\n  cube([30, 30, 20], center = true);\n  cylinder(h = 25, r = 8, center = true);\n}\n')}
          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[11px] transition-colors"
        >
          difference()
        </button>
        <button
          onClick={() => insertSnippet('translate([10, 0, 0])\n')}
          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[11px] transition-colors"
        >
          translate()
        </button>
        <button
          onClick={() => insertSnippet('rotate([0, 0, 45])\n')}
          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[11px] transition-colors"
        >
          rotate()
        </button>
        <button
          onClick={() => insertSnippet('/* [Nové parametry] */\nrozmer = 40; // [10:1:100]\n')}
          className="px-2 py-0.5 bg-amber-950/40 text-amber-300 border border-amber-800/50 hover:bg-amber-900/40 rounded font-mono text-[11px] transition-colors"
        >
          + Customizer
        </button>
      </div>

      {/* Editor Body with Line Numbers */}
      <div className="relative flex-1 flex overflow-hidden font-mono text-xs">
        {/* Line Numbers */}
        <div className="w-10 pt-3 pb-3 bg-slate-950 text-slate-600 text-right pr-2 select-none font-mono text-[11px] border-r border-slate-900 overflow-hidden">
          {lines.map((_, i) => {
            const hasError = errors.some((err) => err.line === i + 1);
            return (
              <div
                key={i}
                className={`leading-5 ${hasError ? 'text-rose-400 font-bold bg-rose-950/30' : ''}`}
              >
                {i + 1}
              </div>
            );
          })}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="flex-1 w-full h-full p-3 bg-transparent text-slate-200 resize-none focus:outline-hidden leading-5 font-mono selection:bg-amber-500/30 selection:text-white overflow-auto whitespace-pre tab-2"
          placeholder="// Zde zadejte OpenSCAD kód..."
        />
      </div>

      {/* Error & Warning Console Bar */}
      {errors.length > 0 && (
        <div className="max-h-28 overflow-y-auto bg-rose-950/80 border-t border-rose-800/60 p-2.5 text-xs text-rose-200 select-text">
          <div className="flex items-center gap-1.5 font-semibold text-rose-300 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              {isCs ? 'Chyby v kódu' : 'Compilation Errors'} ({errors.length})
            </span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            {errors.map((err, idx) => (
              <div key={idx} className="flex items-start gap-1">
                <span className="text-rose-400 font-bold shrink-0">
                  [{isCs ? 'Řádek' : 'Line'} {err.line || 1}]:
                </span>
                <span>{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
