import React, { useState, useRef, useEffect } from 'react';
import { X, ExternalLink, Maximize2, Minimize2, Sparkles, Tag, Film, Play, RotateCcw, MonitorPlay, ShieldAlert } from 'lucide-react';

export default function FloatingPlayerModal({ reel, onClose }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [playerMode, setPlayerMode] = useState('direct'); // 'direct' | 'embed'
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);

  if (!reel) return null;

  const isYouTube = Boolean(
    reel.instagramUrl && (reel.instagramUrl.includes('youtube.com') || reel.instagramUrl.includes('youtu.be'))
  );

  const platformName = isYouTube ? 'YouTube Short' : 'Instagram Reel';

  // Embed URL calculation:
  // For YouTube: clean autoplay embed
  // For Instagram: use clean /embed/ (without /captioned/ which injects the redirect overlay)
  const embedUrl = isYouTube
    ? `https://www.youtube.com/embed/${reel.shortcode}?autoplay=1&enablejsapi=1&playsinline=1&rel=0`
    : `https://www.instagram.com/reel/${reel.shortcode}/embed/`;

  // Video direct stream URL
  const directVideoSrc = reel.videoUrl || `/api/reels/${reel.id}/stream`;

  // Determine whether to use direct HTML5 video player or embed
  const canPlayDirect = !isYouTube && (reel.videoUrl || !videoError);

  // Auto-switch to embed if direct player errors
  const handleVideoError = () => {
    console.warn('Direct video playback unavailable, falling back to embedded player');
    setVideoError(true);
    setPlayerMode('embed');
  };

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
          className={`relative bg-black flex flex-col items-center justify-center ${
            isMinimized ? 'aspect-[9/16] max-h-64' : 'flex-1 md:w-3/5 h-64 md:h-full'
          }`}
        >
          {/* Top Player Mode Switcher (Instagram only) */}
          {!isYouTube && !isMinimized && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1 p-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 shadow">
              <button
                type="button"
                onClick={() => setPlayerMode('direct')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  playerMode === 'direct'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Play in-app HTML5 video"
              >
                <MonitorPlay className="w-3 h-3" />
                <span>In-App Player</span>
              </button>
              <button
                type="button"
                onClick={() => setPlayerMode('embed')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  playerMode === 'embed'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View embedded reel frame"
              >
                <Film className="w-3 h-3" />
                <span>Embed Frame</span>
              </button>
            </div>
          )}

          {/* YouTube Native Embed */}
          {isYouTube ? (
            <iframe
              src={embedUrl}
              title={reel.caption || 'YouTube player'}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : playerMode === 'direct' && canPlayDirect ? (
            /* HTML5 Direct Video Player - Plays in-app without redirecting */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video
                ref={videoRef}
                key={reel.id}
                src={directVideoSrc}
                poster={reel.thumbnailUrl}
                controls
                autoPlay
                playsInline
                loop
                onError={handleVideoError}
                className="w-full h-full max-h-[85vh] object-contain"
              >
                Your browser does not support HTML5 video.
              </video>
            </div>
          ) : (
            /* Instagram Clean Embed with Sandbox Restriction to Prevent Forced Redirects */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <iframe
                src={embedUrl}
                title={reel.caption || 'Instagram reel player'}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                allowFullScreen
              />
            </div>
          )}
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

              {/* Author and Collection */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  @{reel.authorName || 'creator'}
                </span>
                {reel.collectionName && (
                  <span className="text-[11px] text-violet-400 font-medium">
                    {reel.collectionName}
                  </span>
                )}
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
            <div className="pt-4 border-t border-slate-800 mt-4 space-y-2">
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
