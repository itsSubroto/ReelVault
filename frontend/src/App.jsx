import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ReelGrid from './components/ReelGrid';
import SaveReelModal from './components/SaveReelModal';
import CreateCollectionModal from './components/CreateCollectionModal';
import FloatingPlayerModal from './components/FloatingPlayerModal';
import AuthModal from './components/AuthModal';
import { api } from './api/client';
import { Sparkles, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [reels, setReels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] = useState(false);
  const [activePlayingReel, setActivePlayingReel] = useState(null);
  const [pollingUntil, setPollingUntil] = useState(0);
  const [errorBanner, setErrorBanner] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('reelvault-theme') || 'dark';
  });

  // Sync theme with html root class
  useEffect(() => {
    localStorage.setItem('reelvault-theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Check auth session on startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const user = await api.getMe();
        if (user) {
          setCurrentUser(user);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const handleOpenAuthModal = (mode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setCollections([]);
    setReels([]);
    setSelectedCollectionId(null);
  };

  const handleOpenSaveModal = () => {
    if (!currentUser) {
      handleOpenAuthModal('login');
      return;
    }
    setIsSaveModalOpen(true);
  };

  const handleOpenCreateCollectionModal = () => {
    if (!currentUser) {
      handleOpenAuthModal('login');
      return;
    }
    setIsCreateCollectionModalOpen(true);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleGoHome = () => {
    setSelectedCollectionId(null);
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch collections
  const loadCollections = useCallback(async () => {
    try {
      const data = await api.getCollections();
      setCollections(data || []);
    } catch (err) {
      console.error('Failed to load collections:', err);
      setCollections([]);
    }
  }, []);

  // Fetch reels based on active collection or search
  const loadReels = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    try {
      if (searchQuery.trim()) {
        const results = await api.search(searchQuery.trim(), selectedCollectionId);
        setReels(results || []);
      } else {
        const data = await api.getReels(selectedCollectionId);
        setReels(data || []);
      }
      setErrorBanner(null);
    } catch (err) {
      console.error('Failed to fetch reels:', err);
      if (currentUser) {
        setErrorBanner('Could not load reels. Please ensure the backend is running.');
      }
      setReels([]);
    } finally {
      if (showLoadingState) setIsLoading(false);
    }
  }, [searchQuery, selectedCollectionId, currentUser]);

  // Load when user logs in or state changes
  useEffect(() => {
    if (currentUser) {
      loadCollections();
      loadReels();
    } else {
      setCollections([]);
      setReels([]);
      setSelectedCollectionId(null);
    }
  }, [currentUser, loadCollections, loadReels]);

  // Search debounce and collection change handler
  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      loadReels();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadReels, currentUser]);

  // Auto-poll when any reel is currently PROCESSING or during the post-save polling window
  useEffect(() => {
    if (!currentUser) return;
    const hasProcessing = reels.some((r) => r.status === 'PROCESSING');
    const isWindowActive = Date.now() < pollingUntil;

    if (!hasProcessing && !isWindowActive) return;

    const interval = setInterval(() => {
      loadReels(false);
    }, 2000);

    return () => clearInterval(interval);
  }, [reels, pollingUntil, loadReels, currentUser]);

  // Handle Reel Save
  const handleSaveReel = async (url, collectionId) => {
    await api.saveReel(url, collectionId);
    // Keep active polling for 20s so the UI updates automatically as soon as AI enrichment finishes
    setPollingUntil(Date.now() + 20000);
    await Promise.all([loadReels(false), loadCollections()]);
  };

  // Handle Single Reel AI Processing
  const handleProcessReel = async (id) => {
    try {
      await api.processReel(id);
      setPollingUntil(Date.now() + 15000);
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
      setPollingUntil(Date.now() + 25000);
      setReels((prev) =>
        prev.map((r) => (!r.thumbnailUrl || r.status === 'SAVED' ? { ...r, status: 'PROCESSING' } : r))
      );
      setTimeout(() => {
        loadReels(false);
        setIsSyncing(false);
      }, 2500);
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
    return newCol;
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
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-violet-500/30 transition-colors duration-200">
      {/* Header / Navbar */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSaveModal={handleOpenSaveModal}
        onOpenCreateCollectionModal={handleOpenCreateCollectionModal}
        onSyncAll={handleSyncAll}
        isSyncing={isSyncing}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onGoHome={handleGoHome}
        currentUser={currentUser}
        onOpenAuthModal={handleOpenAuthModal}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-4 md:px-6 py-6 flex flex-col md:flex-row gap-6">
        {/* Left Sidebar */}
        <Sidebar
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={setSelectedCollectionId}
          onOpenCreateCollectionModal={handleOpenCreateCollectionModal}
          onDeleteCollection={handleDeleteCollection}
          totalReelsCount={totalReelsCount}
        />

        {/* Content Area */}
        <section className="flex-1 min-w-0 space-y-6">
          {/* Sign In Prompt for unauthenticated visitors */}
          {!currentUser && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-950/40 via-purple-950/40 to-pink-950/40 border border-violet-800/40 text-xs sm:text-sm text-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-semibold block text-white">Sign in to save and organize your reels</span>
                  <span className="text-xs text-slate-400">Create collections, save Instagram reels & YouTube shorts, and search transcripts with AI.</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleOpenAuthModal('login')}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 shadow transition-all cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => handleOpenAuthModal('register')}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
                >
                  Register
                </button>
              </div>
            </div>
          )}

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
                <span>{selectedCollection ? selectedCollection.name : 'All Saved Reels & Shorts'}</span>
                {searchQuery && (
                  <span className="text-xs font-normal text-slate-400 font-mono">
                    matching "{searchQuery}"
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedCollection?.description
                  ? selectedCollection.description
                  : `${reels.length} ${reels.length === 1 ? 'video' : 'videos'} saved`}
              </p>
            </div>

            {/* Informational search capability badge (informative text, not button-like) */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 py-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-medium text-[11px] tracking-wide text-slate-400">
                AI Search indexed across Caption • Transcript • Summary • Tags
              </span>
            </div>
          </div>

          {/* Reels Grid */}
          <ReelGrid
            reels={reels}
            isLoading={isLoading}
            searchQuery={searchQuery}
            onDeleteReel={handleDeleteReel}
            onProcessReel={handleProcessReel}
            onOpenSaveModal={handleOpenSaveModal}
            onPlayReel={(reel) => setActivePlayingReel(reel)}
          />
        </section>
      </main>

      {/* Floating Video Player Modal */}
      {activePlayingReel && (
        <FloatingPlayerModal
          reel={activePlayingReel}
          onClose={() => setActivePlayingReel(null)}
        />
      )}

      {/* Modals */}
      <SaveReelModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        collections={collections}
        defaultCollectionId={selectedCollectionId}
        onSave={handleSaveReel}
        onCreateCollection={handleCreateCollection}
      />

      <CreateCollectionModal
        isOpen={isCreateCollectionModalOpen}
        onClose={() => setIsCreateCollectionModalOpen(false)}
        onCreate={handleCreateCollection}
        existingCollections={collections}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />
    </div>
  );
}
