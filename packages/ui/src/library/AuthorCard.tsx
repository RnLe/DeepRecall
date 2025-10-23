/**
 * AuthorCard Component
 *
 * Individual author card for grid and list views
 */

import type { Author } from "@deeprecall/core";
import { AuthorAvatar } from "./AuthorAvatar";

interface AuthorCardProps {
  author: Author;
  mode: "card" | "list";
  workStats?: Record<string, number>;
  onSelect: (authorId: string) => void;
  getAuthorFullName: (author: Author) => string;
  formatWorkStats: (stats: Record<string, number>) => string;
}

export function AuthorCard({
  author,
  mode,
  workStats = {},
  onSelect,
  getAuthorFullName,
  formatWorkStats,
}: AuthorCardProps) {
  const statsText = formatWorkStats(workStats);

  if (mode === "card") {
    return (
      <button
        onClick={() => onSelect(author.id)}
        className="relative group bg-neutral-800/30 hover:bg-neutral-800/40 border border-neutral-700/50 hover:border-neutral-600 rounded-lg transition-all text-left overflow-hidden h-32 cursor-pointer"
      >
        {/* 2-Column Layout */}
        <div className="flex h-full">
          {/* Left Column - Avatar */}
          <div className="w-1/3 shrink-0 bg-neutral-800/50 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center p-1">
              <AuthorAvatar
                author={author}
                size="large"
                getAuthorFullName={getAuthorFullName}
              />
            </div>
          </div>

          {/* Right Column - Content */}
          <div className="flex-1 p-2 flex flex-col justify-center min-w-0">
            {/* Author Info */}
            <div className="space-y-0.5">
              <h3 className="font-semibold text-neutral-100 text-sm truncate">
                {getAuthorFullName(author)}
              </h3>
              {author.titles && author.titles.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {author.titles.map((title, idx) => (
                    <span
                      key={idx}
                      className="text-xs text-neutral-400 italic font-serif"
                    >
                      {title}
                    </span>
                  ))}
                </div>
              )}
              {author.affiliation && (
                <p className="text-xs text-neutral-500 line-clamp-1">
                  {author.affiliation}
                </p>
              )}
              {/* Work Stats */}
              {statsText && (
                <p className="text-xs text-neutral-400">{statsText}</p>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  }

  // List mode
  return (
    <button
      onClick={() => onSelect(author.id)}
      className="w-full p-2 bg-neutral-800/30 hover:bg-neutral-800/50 border border-neutral-700/50 hover:border-neutral-600 rounded-lg transition-all text-left group"
    >
      <div className="flex items-center gap-3">
        <AuthorAvatar
          author={author}
          size="small"
          getAuthorFullName={getAuthorFullName}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-neutral-100 text-sm truncate">
              {getAuthorFullName(author)}
            </h3>
            {author.titles && author.titles.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                {author.titles.slice(0, 2).map((title, idx) => (
                  <span
                    key={idx}
                    className="text-xs text-neutral-400 italic font-serif"
                  >
                    {title}
                  </span>
                ))}
                {author.titles.length > 2 && (
                  <span className="text-xs text-neutral-500">
                    +{author.titles.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs truncate">
            {author.affiliation && (
              <span className="text-neutral-400 truncate">
                {author.affiliation}
              </span>
            )}
            {statsText && (
              <>
                {author.affiliation && (
                  <span className="text-neutral-600 shrink-0">•</span>
                )}
                <span className="text-neutral-500 shrink-0">{statsText}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
