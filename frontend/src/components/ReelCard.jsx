import React, { useState } from 'react';
import { ExternalLink, Trash2, Film, Folder, Calendar, Sparkles, RefreshCw, Loader2, Tag, Play, Share2, Check } from 'lucide-react';

function highlightText(text, query) {
  if (!query || !text) return text;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={index}
        className="bg-amber-400/30 text-amber-200 px-0.5 rounded font-medium"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function ReelCard({
  reel,
  searchQuery,
  onDeleteReel,
  onProcessReel,
  onPlayReel,
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);

  const formattedDate = reel.createdAt
    ? new Date(reel.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : '';

  const isYouTube = Boolean(
    reel.instagramUrl && (reel.instagramUrl.includes('youtube.com') || reel.instagramUrl.includes('youtu.be'))
  );

  const handleShare = async (e) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({
          title: reel.caption || 'ReelVault Video',
          url: reel.instagramUrl,
        });
      } else {
        await navigator.clipboard.writeText(reel.instagramUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(reel.instagramUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // ignore
        }
      }
    }
  };

  const caption = reel.caption || 'No caption available.';

  const handleProcess = async (e) => {
    e.stopPropagation();
    if (!onProcessReel || isProcessing) return;
    try {
      setIsProcessing(true);
      await onProcessReel(reel.id);
    } catch (err) {
      console.error('Failed to trigger processing:', err);
    } finally {
      setTimeout(() => setIsProcessing(false), 1500);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDeleteReel(reel.id);
  };

  const getStatusBadge = () => {
    const status = reel.status || 'SAVED';
    switch (status) {
      case 'PROCESSING':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-md animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Processing...</span>
          </span>
        );
      case 'DONE':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>AI Ready</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/30 backdrop-blur-md">
            Failed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/50 backdrop-blur-md">
            Saved
          </span>
        );
    }
  };

  return (
    <article className="group relative bg-slate-900/80 border border-slate-800 hover:border-violet-500/50 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-violet-500/10 hover:-translate-y-0.5 flex flex-col h-[520px]">
      {/* Thumbnail Header with Play Trigger */}
      <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden flex items-center justify-center shrink-0">
        {reel.thumbnailUrl && !imageError ? (
          <img
            src={reel.thumbnailUrl}
            alt={reel.caption || 'Video preview'}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-600 p-4 text-center">
            <Film className="w-10 h-10 stroke-[1.5] text-violet-500/50 mb-2" />
            <span className="text-xs font-semibold text-slate-400">
              @{reel.authorName || (isYouTube ? 'youtube_creator' : 'instagram_creator')}
            </span>
          </div>
        )}

        {/* Hover Play Button Overlay */}
        <button
          onClick={() => onPlayReel && onPlayReel(reel)}
          className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/45 opacity-90 group-hover:opacity-100 transition-all cursor-pointer"
          title="Play video in floating window"
        >
          <div className="w-12 h-12 rounded-full bg-violet-600/90 hover:bg-violet-500 text-white flex items-center justify-center shadow-lg shadow-violet-600/40 group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </button>

        {/* Collection Badge */}
        {reel.collectionName && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-medium text-slate-300 shadow pointer-events-none">
            <Folder className="w-3 h-3 text-violet-400" />
            <span>{reel.collectionName}</span>
          </div>
        )}

        {/* Quick Actions (Top Right) */}
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
          <button
            onClick={handleProcess}
            disabled={isProcessing}
            className="p-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-400 hover:text-violet-400 hover:bg-violet-500/20 transition-all shadow cursor-pointer"
            title="Extract thumbnail & process with AI"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin text-violet-400' : ''}`} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-all shadow cursor-pointer"
            title="Delete reel"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Status Tag (Bottom Left) */}
        <div className="absolute bottom-3 left-3 pointer-events-none">
          {getStatusBadge()}
        </div>
      </div>

      {/* Card Body with Constant Height & Scrollable Content */}
      <div className="p-4 flex-1 flex flex-col justify-between overflow-hidden">
        {/* Author & Date Header */}
        <div className="flex items-center justify-between text-xs text-slate-400 shrink-0 mb-2">
          <span className="font-semibold text-slate-200 truncate max-w-[180px]">
            {reel.authorName ? `@${reel.authorName}` : (isYouTube ? '@youtube_creator' : '@instagram_creator')}
          </span>
          {formattedDate && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
              <Calendar className="w-3 h-3" />
              {formattedDate}
            </span>
          )}
        </div>

        {/* Scrollable Middle Content (Caption, AI Summary, Tags) */}
        <div className="flex-1 overflow-y-auto pr-1.5 space-y-2.5 text-xs text-slate-300 leading-relaxed scrollbar-thin">
          {/* Caption */}
          <div className="break-words">
            <p className="whitespace-pre-line text-xs sm:text-[13px] text-slate-300">
              {highlightText(caption, searchQuery)}
            </p>
          </div>

          {/* AI Summary Box */}
          {reel.summary && (
            <div className="p-2.5 rounded-xl bg-violet-950/40 border border-violet-800/30 text-xs text-violet-200">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold flex items-center gap-1 text-[11px] text-violet-300">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  AI Summary
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-normal">
                {highlightText(reel.summary, searchQuery)}
              </p>
            </div>
          )}

          {/* Tags */}
          {reel.tags && reel.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {reel.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/70 text-slate-300 border border-slate-700/50"
                >
                  <Tag className="w-2.5 h-2.5 text-violet-400" />
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Card Footer Actions */}
        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between shrink-0 mt-2">
          <button
            onClick={() => onPlayReel && onPlayReel(reel)}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play Video</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-violet-400 transition-colors cursor-pointer"
              title="Share or copy video link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>

            <a
              href={reel.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>{isYouTube ? 'YouTube' : 'Instagram'}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
