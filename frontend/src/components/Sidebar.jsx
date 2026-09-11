import React from 'react';
import { Layers, Folder, Plus, Trash2 } from 'lucide-react';

export default function Sidebar({
  collections,
  selectedCollectionId,
  onSelectCollection,
  onOpenCreateCollectionModal,
  onDeleteCollection,
  totalReelsCount,
}) {
  return (
    <aside className="w-full md:w-64 shrink-0 space-y-4">
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Collections
          </span>
          <button
            onClick={onOpenCreateCollectionModal}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-violet-400 transition-colors"
            title="Create new collection"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Collections List */}
        <nav className="space-y-1">
          {/* All Reels */}
          <button
            onClick={() => onSelectCollection(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedCollectionId === null
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Layers className={`w-4 h-4 ${selectedCollectionId === null ? 'text-violet-400' : 'text-slate-400'}`} />
              <span className="truncate">All Saved Reels</span>
            </div>
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-400 font-mono">
              {totalReelsCount}
            </span>
          </button>

          {/* User Collections */}
          {collections.map((col) => {
            const isSelected = selectedCollectionId === col.id;
            return (
              <div
                key={col.id}
                className={`group flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <button
                  onClick={() => onSelectCollection(col.id)}
                  className="flex items-center gap-2.5 truncate flex-1 text-left"
                >
                  <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-violet-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                  <span className="truncate" title={col.name}>
                    {col.name}
                  </span>
                </button>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-400 font-mono group-hover:hidden">
                    {col.reelCount ?? 0}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCollection(col.id, col.name);
                    }}
                    className="hidden group-hover:block p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title={`Delete "${col.name}"`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {collections.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-slate-500">
              No collections yet. Create one to organize your reels!
            </div>
          )}
        </nav>
      </div>
    </aside>
  );
}
