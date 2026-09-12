import React from 'react';
import { Film, Search, Plus, X, FolderPlus, RefreshCw } from 'lucide-react';

export default function Navbar({
  searchQuery,
  onSearchChange,
  onOpenSaveModal,
  onOpenCreateCollectionModal,
  onSyncAll,
  isSyncing,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0 cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-pink-600 to-amber-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-lg bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              ReelVault
            </span>
            <span className="text-[10px] block font-mono text-violet-400 -mt-1 tracking-wider uppercase">
              Save & Search Reels
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-xl relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search reels by caption, transcript, summary, or tags..."
              className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-950/70 border border-slate-700/60 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 text-slate-400 hover:text-slate-200"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {onSyncAll && (
            <button
              onClick={onSyncAll}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors disabled:opacity-50"
              title="Sync thumbnails & AI metadata for all saved reels"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-violet-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync AI'}</span>
            </button>
          )}

          <button
            onClick={onOpenCreateCollectionModal}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
            title="New Collection"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New Collection</span>
          </button>

          <button
            onClick={onOpenSaveModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 rounded-xl shadow-md shadow-violet-600/25 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Save Reel</span>
          </button>
        </div>
      </div>
    </header>
  );
}
