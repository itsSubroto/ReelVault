import React, { useState } from 'react';
import { ExternalLink, Trash2, Film, Folder, Calendar, Sparkles, RefreshCw, Loader2, Tag } from 'lucide-react';

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
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [imageError, setImageError] = useState(false);

  const formattedDate = reel.createdAt
    ? new Date(reel.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : '';

  const caption = reel.caption || 'No caption available.';
  const isLongCaption = caption.length > 140;

  const handleProcess = async () => {
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
    <article className="group relative bg-slate-900/80 border border-slate-800 hover:border-violet-500/50 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-violet-500/10 hover:-translate-y-0.5 flex flex-col">
      {/* Thumbnail Header */}
      <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden flex items-center justify-center">
        {reel.thumbnailUrl && !imageError ? (
          <img
            src={reel.thumbnailUrl}
            alt={reel.caption || 'Instagram Reel'}
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
              @{reel.authorName || 'instagram_creator'}
            </span>
            <span className="text-[10px] font-mono text-slate-600 mt-1">
              #{reel.shortcode}
            </span>
          </div>
        )}

        {/* Collection Badge */}
        {reel.collectionName && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-medium text-slate-300 shadow">
            <Folder className="w-3 h-3 text-violet-400" />
            <span>{reel.collectionName}</span>
          </div>
        )}

        {/* Quick Actions (Top Right) */}
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={handleProcess}
            disabled={isProcessing}
            className="p-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-400 hover:text-violet-400 hover:bg-violet-500/20 transition-all shadow"
            title="Extract thumbnail & process with AI"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin text-violet-400' : ''}`} />
          </button>
          <button
            onClick={() => onDeleteReel(reel.id)}
            className="p-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-all shadow"
            title="Delete reel"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Status Tag (Bottom Left) */}
        <div className="absolute bottom-3 left-3">
          {getStatusBadge()}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        {/* Author & Date */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-200 truncate max-w-[180px]">
            {reel.authorName ? `@${reel.authorName}` : '@instagram_creator'}
          </span>
          {formattedDate && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
              <Calendar className="w-3 h-3" />
              {formattedDate}
            </span>
          )}
        </div>

        {/* Caption */}
        <div className="text-xs sm:text-sm text-slate-300 leading-relaxed break-words flex-1">
          <p className="whitespace-pre-line">
            {isExpanded || !isLongCaption
              ? highlightText(caption, searchQuery)
              : highlightText(caption.slice(0, 140) + '...', searchQuery)}
          </p>
          {isLongCaption && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-xs text-violet-400 hover:text-violet-300 font-medium cursor-pointer"
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>

        {/* AI Summary Box (if present) */}
        {reel.summary && (
          <div className="p-2.5 rounded-xl bg-violet-950/30 border border-violet-800/30 text-xs text-violet-200">
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

        {/* Card Footer Actions */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <a
            href={reel.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            <span>View on Instagram</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <span className="text-[10px] font-mono text-slate-500">
            #{reel.shortcode}
          </span>
        </div>
      </div>
    </article>
  );
}
