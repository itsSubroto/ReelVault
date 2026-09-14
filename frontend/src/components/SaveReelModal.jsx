import React, { useState } from 'react';
import { X, Link as LinkIcon, Folder, Loader2, AlertCircle, Plus } from 'lucide-react';

export default function SaveReelModal({
  isOpen,
  onClose,
  collections,
  defaultCollectionId,
  onSave,
  onCreateCollection,
}) {
  const [url, setUrl] = useState('');
  const [collectionId, setCollectionId] = useState(defaultCollectionId || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [isCreatingColLoading, setIsCreatingColLoading] = useState(false);
  const [colError, setColError] = useState(null);
  const inputRef = React.useRef(null);

  // Sync default collection and auto-focus input when opened
  React.useEffect(() => {
    if (defaultCollectionId) {
      setCollectionId(defaultCollectionId);
    } else if (collections.length > 0 && !collectionId) {
      setCollectionId(collections[0].id);
    }
  }, [defaultCollectionId, collections]);

  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleQuickCreateCollection = async (e) => {
    e.preventDefault();
    const trimmed = newColName.trim();
    if (!trimmed) {
      setColError('Collection name is required');
      return;
    }
    if (collections.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setColError(`Collection "${trimmed}" already exists`);
      return;
    }
    try {
      setIsCreatingColLoading(true);
      setColError(null);
      if (onCreateCollection) {
        const created = await onCreateCollection(trimmed, newColDesc.trim());
        if (created && created.id) {
          setCollectionId(created.id);
        }
      }
      setNewColName('');
      setNewColDesc('');
      setIsCreatingCollection(false);
    } catch (err) {
      setColError(err.message || 'Failed to create collection');
    } finally {
      setIsCreatingColLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setError('Please enter a video URL');
      return;
    }
    if (!collectionId) {
      setError('Please choose or create a collection first');
      return;
    }

    // Dual platform check: Instagram Reels & YouTube Shorts
    const isInstagram =
      cleanUrl.includes('instagram.com/reel/') ||
      cleanUrl.includes('instagram.com/p/') ||
      cleanUrl.includes('instagram.com/reels/');

    const isYouTube =
      cleanUrl.includes('youtube.com/shorts/') ||
      cleanUrl.includes('youtu.be/') ||
      cleanUrl.includes('youtube.com/watch');

    if (!isInstagram && !isYouTube) {
      setError('Must be an Instagram Reel (instagram.com/reel/...) or YouTube Short (youtube.com/shorts/...)');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await onSave(cleanUrl, collectionId);
      setUrl('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save video');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-violet-400" />
          <span>Save Reel or Short</span>
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          Paste an Instagram Reel or YouTube Short URL to automatically fetch its thumbnail, creator, and AI summary.
        </p>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div className="space-y-0.5">
              <span className="font-semibold block text-amber-200">
                {error.toLowerCase().includes('already saved') ? 'Already Saved' : 'Notice'}
              </span>
              <span className="leading-relaxed">{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reel Link Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Reel / Short URL
            </label>
            <input
              ref={inputRef}
              type="url"
              required
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://www.instagram.com/reel/... or https://youtube.com/shorts/..."
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
          </div>

          {/* Collection Picker with Inline New Collection Creator */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Collection
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingCollection(!isCreatingCollection);
                  setColError(null);
                }}
                className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{isCreatingCollection ? 'Select Existing' : '+ New Collection'}</span>
              </button>
            </div>

            {isCreatingCollection ? (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-violet-500/40 space-y-2.5">
                {colError && (
                  <div className="text-[11px] text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{colError}</span>
                  </div>
                )}
                <div>
                  <input
                    type="text"
                    value={newColName}
                    onChange={(e) => {
                      setNewColName(e.target.value);
                      setColError(null);
                    }}
                    placeholder="New collection name (e.g. Recipes, Tech)"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingCollection(false);
                      setColError(null);
                    }}
                    className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickCreateCollection}
                    disabled={isCreatingColLoading || !newColName.trim()}
                    className="px-3 py-1 rounded-lg text-[11px] font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {isCreatingColLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Create & Select</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  disabled={isLoading || collections.length === 0}
                  className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                >
                  {collections.length === 0 ? (
                    <option value="">No collections - click '+ New Collection' above</option>
                  ) : (
                    collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
                <Folder className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || collections.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 rounded-xl shadow-md shadow-violet-600/20 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Fetching & Saving...</span>
                </>
              ) : (
                <span>Save Reel</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
