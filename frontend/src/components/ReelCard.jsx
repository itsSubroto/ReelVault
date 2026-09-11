import React, { useState } from 'react';
import { ExternalLink, Trash2, Film, Folder, Calendar } from 'lucide-react';

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
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedDate = reel.createdAt
    ? new Date(reel.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : '';

  const caption = reel.caption || 'No caption available.';
  const isLongCaption = caption.length > 140;

  return (
    <article className="group relative bg-slate-900/80 border border-slate-800 hover:border-violet-500/50 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-violet-500/10 hover:-translate-y-0.5 flex flex-col">
      {/* Thumbnail Header */}
      <div className="relative aspect-[9/10] sm:aspect-[4/3] bg-slate-950 overflow-hidden">
        {reel.thumbnailUrl ? (
          <img
            src={reel.thumbnailUrl}
            alt={reel.caption || 'Instagram Reel'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => {
              // Hide broken image link and show fallback
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement.classList.add('fallback-active');
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-600">
            <Film className="w-12 h-12 stroke-[1.5] text-slate-700 mb-2" />
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Instagram Reel
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

        {/* Delete Quick Action */}
        <button
          onClick={() => onDeleteReel(reel.id)}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all shadow"
          title="Delete reel"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Status Tag (Phase 1/2) */}
        <div className="absolute bottom-3 left-3">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider bg-violet-600/80 text-white backdrop-blur-sm">
            {reel.status || 'SAVED'}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        {/* Author */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-200 truncate">
            @{reel.authorName || 'instagram_creator'}
          </span>
          {formattedDate && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Calendar className="w-3 h-3" />
              {formattedDate}
            </span>
          )}
        </div>

        {/* Caption */}
        <div className="text-xs sm:text-sm text-slate-300 leading-relaxed break-words flex-1">
          <p>
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
