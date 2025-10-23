/**
 * AuthorAvatar Component
 *
 * Displays an author's avatar with fallback to initials
 */

import type { Author } from "@deeprecall/core";

interface AuthorAvatarProps {
  author: Author;
  size?: "small" | "medium" | "large";
  className?: string;
  getAuthorFullName: (author: Author) => string;
}

export function AuthorAvatar({
  author,
  size = "medium",
  className = "",
  getAuthorFullName,
}: AuthorAvatarProps) {
  const sizeClasses = {
    small: "w-8 h-8 text-xs",
    medium: "w-12 h-12 text-sm",
    large: "w-24 h-24 text-lg",
  };

  const initials = `${author.firstName[0]}${author.lastName[0]}`.toUpperCase();

  if (author.avatarDisplayPath) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden shrink-0 ${className}`}
      >
        <img
          src={author.avatarDisplayPath}
          alt={getAuthorFullName(author)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback: gradient with initials
  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-linear-to-br from-blue-600 to-purple-600 flex items-center justify-center font-medium text-white shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}
