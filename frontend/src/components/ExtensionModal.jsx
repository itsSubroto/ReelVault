import React, { useState } from 'react';
import { X, Copy, Check, Puzzle, Zap, MousePointer, Command, ShieldCheck, Sparkles } from 'lucide-react';
import { getToken } from '../api/client';

export default function ExtensionModal({ isOpen, onClose, currentUser }) {
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  if (!isOpen) return null;

  const extensionPath = 'D:\\ReelVault\\extension';
  const token = getToken();

  const handleCopyPath = () => {
    navigator.clipboard.writeText(extensionPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2500);
  };

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-pink-600 to-amber-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Puzzle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                ReelVault Browser Extension
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Quick Save
                </span>
              </h2>
              <p className="text-xs text-slate-400">Save YouTube videos & Instagram Reels in 1-click</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Quick Highlight Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col items-center text-center">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center mb-2">
                <Zap className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white">In-Page Button</span>
              <span className="text-[11px] text-slate-400 mt-1">Floating save button on YouTube & Instagram</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col items-center text-center">
              <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center mb-2">
                <MousePointer className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white">Context Menu</span>
              <span className="text-[11px] text-slate-400 mt-1">Right-click any video to save directly</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col items-center text-center">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                <Command className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white">Alt + Shift + S</span>
              <span className="text-[11px] text-slate-400 mt-1">Global keyboard shortcut for instant saving</span>
            </div>
          </div>

          {/* Installation Steps */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Installation Steps (30 seconds)
            </h3>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 font-bold flex items-center justify-center text-[11px] shrink-0">
                  1
                </span>
                <div>
                  Open Chrome / Edge / Brave and type <code className="px-1.5 py-0.5 rounded bg-slate-800 text-violet-300 font-mono">chrome://extensions</code> in the URL bar.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 font-bold flex items-center justify-center text-[11px] shrink-0">
                  2
                </span>
                <div>
                  Turn ON <strong>"Developer mode"</strong> switch in the top-right corner.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 font-bold flex items-center justify-center text-[11px] shrink-0">
                  3
                </span>
                <div className="flex-1">
                  Click <strong>"Load unpacked"</strong> and select the ReelVault extension directory:
                  <div className="mt-2 flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={extensionPath} 
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-[11px] text-violet-300 select-all"
                    />
                    <button
                      onClick={handleCopyPath}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      {copiedPath ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPath ? 'Copied' : 'Copy Path'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 font-bold flex items-center justify-center text-[11px] shrink-0">
                  4
                </span>
                <div>
                  Pin <strong>ReelVault</strong> to your browser toolbar and click the icon to log in!
                </div>
              </div>
            </div>
          </div>

          {/* User Session Helper */}
          {currentUser && (
            <div className="p-3.5 rounded-xl bg-violet-950/30 border border-violet-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold text-white">
                    Logged in as @{currentUser.username}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    You can log in directly in the extension popup using your credentials.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
