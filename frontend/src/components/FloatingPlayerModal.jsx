import React, { useState } from 'react';
import { X, ExternalLink, Maximize2, Minimize2, Sparkles, Tag, Film } from 'lucide-react';

export default function FloatingPlayerModal({ reel, onClose }) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!reel) return null;

  const isYouTube =
    (reel.instagramUrl && (reel.instagramUrl.includes('youtube.com') || reel.instagramUrl.includes('youtu.be'))) ||
    reel.shortcode?.length === 11;

  const embedUrl = isYouTube
    ? `https://www.youtube.com/embed/${reel.shortcode}?autoplay=1&rel=0`
    : `https://www.instagram.com/reel/${reel.shortcode}/embed/`;

  const platformName = isYouTube ? 'YouTube Short' : 'Instagram Reel';

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isMinimized
          ? 'bottom-4 right-4 w-72 sm:w-80 shadow-2xl rounded-2xl overflow-hidden border border-slate-700 bg-slate-900'
          : 'fixed inset-0 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200'
      }`}
    >
      <div
        className={`w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
          isMinimized
            ? 'h-auto'
            : 'max-w-4xl max-h-[92vh] h-full sm:h-[680px] md:flex-row'
        }`}
      >
        {/* Header (Visible on Mobile or when Minimized) */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 text-xs text-slate-300 md:hidden">
          <span className="font-semibold truncate max-w-[200px] flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span>{reel.caption || platformName}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded text-slate-400 hover:text-slate-200"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-red-400"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Player Column */}
        <div
          className={`relative bg-black flex items-center justify-center ${
            isMinimized ? 'aspect-[9/16] max-h-64' : 'flex-1 md:w-3/5 h-64 md:h-full'
          }`}
        >
          <iframe
            src={embedUrl}
            title={reel.caption || 'Video player'}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        {/* Details & Action Column (Hidden if minimized) */}
        {!isMinimized && (
          <div className="md:w-2/5 flex flex-col justify-between p-4 sm:p-5 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 overflow-y-auto">
            <div className="space-y-4">
              {/* Header Actions for Desktop */}
              <div className="hidden md:flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[11px] font-mono uppercase tracking-wider text-violet-400 font-semibold flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  <span>{platformName}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsMinimized(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    title="Minimize to floating window"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Author and Shortcode */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  @{reel.authorName || 'creator'}
                </span>
                <span className="font-mono text-slate-500 text-[11px]">
                  #{reel.shortcode}
                </span>
              </div>

              {/* Caption */}
              <div className="text-xs sm:text-sm text-slate-300 max-h-40 overflow-y-auto pr-1">
                <p className="whitespace-pre-line leading-relaxed">{reel.caption}</p>
              </div>

              {/* AI Summary */}
              {reel.summary && (
                <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-800/40 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-violet-300 text-[11px] mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>AI Summary</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {reel.summary}
                  </p>
                </div>
              )}

              {/* Tags */}
              {reel.tags && reel.tags.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                    Topics & Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {reel.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        <Tag className="w-2.5 h-2.5 text-violet-400" />
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Redirect Action */}
            <div className="pt-4 border-t border-slate-800 mt-4">
              <a
                href={reel.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 shadow-lg shadow-violet-600/20 active:scale-[0.98] transition-all"
              >
                <span>Open original on {isYouTube ? 'YouTube' : 'Instagram'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
