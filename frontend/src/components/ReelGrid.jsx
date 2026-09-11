import React from 'react';
import ReelCard from './ReelCard';
import { Film, SearchX, Plus } from 'lucide-react';

export default function ReelGrid({
  reels,
  isLoading,
  searchQuery,
  onDeleteReel,
  onOpenSaveModal,
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div
            key={n}
            className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 animate-pulse space-y-4"
          >
            <div className="aspect-[4/3] bg-slate-800/60 rounded-xl" />
            <div className="h-4 bg-slate-800/60 rounded w-1/3" />
            <div className="h-3 bg-slate-800/40 rounded w-full" />
            <div className="h-3 bg-slate-800/40 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (reels.length === 0) {
    if (searchQuery) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <div className="p-3 bg-slate-800/50 rounded-2xl text-slate-400 mb-3">
            <SearchX className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-200 mb-1">
            No reels found matching "{searchQuery}"
          </h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Try searching with a different keyword or browse through your collections.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
        <div className="p-4 bg-violet-500/10 rounded-2xl text-violet-400 mb-3">
          <Film className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-1">
          No saved reels yet
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mb-4">
          Paste an Instagram reel link to save it, organize it into collections, and search it anytime.
        </p>
        <button
          onClick={onOpenSaveModal}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-md shadow-violet-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Save Your First Reel</span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {reels.map((reel) => (
        <ReelCard
          key={reel.id}
          reel={reel}
          searchQuery={searchQuery}
          onDeleteReel={onDeleteReel}
        />
      ))}
    </div>
  );
}
