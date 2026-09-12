import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ReelGrid from './components/ReelGrid';
import SaveReelModal from './components/SaveReelModal';
import CreateCollectionModal from './components/CreateCollectionModal';
import { api } from './api/client';
import { Sparkles, AlertCircle } from 'lucide-react';

export default function App() {
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [reels, setReels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);

  // Fetch collections
  const loadCollections = useCallback(async () => {
    try {
      const data = await api.getCollections();
      setCollections(data);
    } catch (err) {
      console.error('Failed to load collections:', err);
    }
  }, []);

  // Fetch reels based on active collection or search
  const loadReels = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    try {
      if (searchQuery.trim()) {
        const results = await api.search(searchQuery.trim(), selectedCollectionId);
        setReels(results);
      } else {
        const data = await api.getReels(selectedCollectionId);
        setReels(data);
      }
      setErrorBanner(null);
    } catch (err) {
      console.error('Failed to fetch reels:', err);
      setErrorBanner('Could not load reels. Please ensure the backend is running.');
    } finally {
      if (showLoadingState) setIsLoading(false);
    }
  }, [searchQuery, selectedCollectionId]);

  // Initial load
  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Search debounce and collection change handler
  useEffect(() => {
    const timer = setTimeout(() => {
      loadReels();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadReels]);

  // Auto-poll when any reel is currently PROCESSING
  useEffect(() => {
    const hasProcessing = reels.some((r) => r.status === 'PROCESSING');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadReels(false);
    }, 2500);

    return () => clearInterval(interval);
  }, [reels, loadReels]);

  // Handle Reel Save
  const handleSaveReel = async (url, collectionId) => {
    await api.saveReel(url, collectionId);
    await Promise.all([loadReels(), loadCollections()]);
  };

  // Handle Single Reel AI Processing
  const handleProcessReel = async (id) => {
    try {
      await api.processReel(id);
      // Mark as PROCESSING locally for instant feedback
      setReels((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'PROCESSING' } : r))
      );
      setTimeout(() => loadReels(false), 2000);
    } catch (err) {
      alert('Failed to trigger processing: ' + err.message);
    }
  };

  // Handle Sync All Reels
  const handleSyncAll = async () => {
    try {
      setIsSyncing(true);
      await api.syncAllReels();
      // Set all to processing
      setReels((prev) =>
        prev.map((r) => (!r.thumbnailUrl || r.status === 'SAVED' ? { ...r, status: 'PROCESSING' } : r))
      );
      setTimeout(() => {
        loadReels(false);
        setIsSyncing(false);
      }, 3000);
    } catch (err) {
      alert('Failed to sync reels: ' + err.message);
      setIsSyncing(false);
    }
  };

  // Handle Reel Delete
  const handleDeleteReel = async (id) => {
    if (!window.confirm('Are you sure you want to remove this reel?')) return;
    try {
      await api.deleteReel(id);
      setReels((prev) => prev.filter((r) => r.id !== id));
      loadCollections();
    } catch (err) {
      alert('Failed to delete reel: ' + err.message);
    }
  };

  // Handle Create Collection
  const handleCreateCollection = async (name, description) => {
    const newCol = await api.createCollection(name, description);
    await loadCollections();
    setSelectedCollectionId(newCol.id);
  };

  // Handle Delete Collection
  const handleDeleteCollection = async (id, name) => {
    if (!window.confirm(`Delete collection "${name}" and all reels inside it?`)) return;
    try {
      await api.deleteCollection(id);
      if (selectedCollectionId === id) {
        setSelectedCollectionId(null);
      }
      loadCollections();
      loadReels();
    } catch (err) {
      alert('Failed to delete collection: ' + err.message);
    }
  };

  const totalReelsCount = collections.reduce((acc, c) => acc + (c.reelCount || 0), 0);
  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100 selection:bg-violet-500/30">
      {/* Header / Navbar */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSaveModal={() => setIsSaveModalOpen(true)}
        onOpenCreateCollectionModal={() => setIsCreateCollectionModalOpen(true)}
        onSyncAll={handleSyncAll}
        isSyncing={isSyncing}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        {/* Left Sidebar */}
        <Sidebar
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={setSelectedCollectionId}
          onOpenCreateCollectionModal={() => setIsCreateCollectionModalOpen(true)}
          onDeleteCollection={handleDeleteCollection}
          totalReelsCount={totalReelsCount}
        />

        {/* Content Area */}
        <section className="flex-1 min-w-0 space-y-6">
          {/* Status banner */}
          {errorBanner && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs sm:text-sm text-red-300 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* Heading / Filter Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>{selectedCollection ? selectedCollection.name : 'All Saved Reels'}</span>
                {searchQuery && (
                  <span className="text-xs font-normal text-slate-400 font-mono">
                    matching "{searchQuery}"
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedCollection?.description
                  ? selectedCollection.description
                  : `${reels.length} ${reels.length === 1 ? 'reel' : 'reels'} saved`}
              </p>
            </div>

            {/* Quick stats / tips */}
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/40 px-3 py-1.5 rounded-xl border border-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Search: Caption + Transcript + Summary + Tags</span>
            </div>
          </div>

          {/* Reels Grid */}
          <ReelGrid
            reels={reels}
            isLoading={isLoading}
            searchQuery={searchQuery}
            onDeleteReel={handleDeleteReel}
            onProcessReel={handleProcessReel}
            onOpenSaveModal={() => setIsSaveModalOpen(true)}
          />
        </section>
      </main>

      {/* Modals */}
      <SaveReelModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        collections={collections}
        defaultCollectionId={selectedCollectionId}
        onSave={handleSaveReel}
      />

      <CreateCollectionModal
        isOpen={isCreateCollectionModalOpen}
        onClose={() => setIsCreateCollectionModalOpen(false)}
        onCreate={handleCreateCollection}
      />
    </div>
  );
}
