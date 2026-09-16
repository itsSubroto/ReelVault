import React from 'react';
import { Film, Search, Plus, X, FolderPlus, RefreshCw, Sun, Moon, LogIn, LogOut, User as UserIcon } from 'lucide-react';

export default function Navbar({
  searchQuery,
  onSearchChange,
  onOpenSaveModal,
  onOpenCreateCollectionModal,
  onSyncAll,
  isSyncing,
  theme,
  onToggleTheme,
  onGoHome,
  currentUser,
  onOpenAuthModal,
  onLogout,
}) {
  const searchInputRef = React.useRef(null);

  // Global keyboard shortcut for search (Ctrl+K, Cmd+K, or '/')
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && !isInputActive) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand */}
        <div
          onClick={onGoHome}
          className="flex items-center gap-3 shrink-0 cursor-pointer group select-none"
          title="Go to ReelVault Home"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-pink-600 to-amber-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-lg bg-gradient-to-r from-white via-slate-200 to-slate-400 group-hover:from-violet-200 group-hover:to-pink-300 bg-clip-text text-transparent transition-all">
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
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search reels by caption, transcript, summary, or tags..."
              className="w-full pl-9 pr-20 py-2 rounded-xl bg-slate-950/70 border border-slate-700/60 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
            <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="pointer-events-auto text-slate-400 hover:text-slate-200"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/60 rounded">
                  <span className="text-[9px]">Ctrl</span> K
                </kbd>
              )}
            </div>
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

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-700/60 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          <button
            onClick={onOpenSaveModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 rounded-xl shadow-md shadow-violet-600/25 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Save Reel</span>
          </button>

          {/* User Profile / Auth Button */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-800">
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs text-slate-200"
                title={`Signed in as @${currentUser.username} (${currentUser.email})`}
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-violet-600 to-pink-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                  {(currentUser.name || currentUser.username)[0].toUpperCase()}
                </div>
                <span className="font-semibold hidden lg:inline truncate max-w-[90px]">
                  {currentUser.name || currentUser.username}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700/60 transition-colors cursor-pointer"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onOpenAuthModal && onOpenAuthModal('login')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-violet-400" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
