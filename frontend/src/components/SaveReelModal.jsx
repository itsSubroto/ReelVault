import React, { useState } from 'react';
import { X, Link as LinkIcon, Folder, Loader2, AlertCircle } from 'lucide-react';

export default function SaveReelModal({
  isOpen,
  onClose,
  collections,
  defaultCollectionId,
  onSave,
}) {
  const [url, setUrl] = useState('');
  const [collectionId, setCollectionId] = useState(defaultCollectionId || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync default collection when opened
  React.useEffect(() => {
    if (defaultCollectionId) {
      setCollectionId(defaultCollectionId);
    } else if (collections.length > 0 && !collectionId) {
      setCollectionId(collections[0].id);
    }
  }, [defaultCollectionId, collections]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter an Instagram reel URL');
      return;
    }
    if (!collectionId) {
      setError('Please choose or create a collection first');
      return;
    }

    // Basic format check
    if (!url.includes('instagram.com/reel/') && !url.includes('instagram.com/p/') && !url.includes('instagram.com/reels/')) {
      setError('Must be a valid Instagram Reel link (e.g. https://www.instagram.com/reel/...)');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await onSave(url.trim(), collectionId);
      setUrl('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save reel');
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
          <span>Save Instagram Reel</span>
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          Paste the reel link to automatically fetch its caption, preview, and organize it.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reel Link Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Instagram Reel URL
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://www.instagram.com/reel/C8XYZ123456/"
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
          </div>

          {/* Collection Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Collection</span>
              {collections.length === 0 && (
                <span className="text-amber-400 text-[11px]">No collections created yet</span>
              )}
            </label>
            <div className="relative">
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                disabled={isLoading || collections.length === 0}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              >
                {collections.length === 0 ? (
                  <option value="">Create a collection first</option>
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
