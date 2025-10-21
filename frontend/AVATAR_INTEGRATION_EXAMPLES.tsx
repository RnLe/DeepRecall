/**
 * Example: Integrating Work Statistics by Type into AuthorLibrary
 *
 * This shows how to replace "X work(s)" with "2 papers, 1 textbook, 3 notes"
 */

// 1. Add this useMemo hook in AuthorListView component (around line 195 in the original)
const authorWorkStats = useMemo(() => {
  const stats = new Map<string, Record<string, number>>();

  works.forEach((work) => {
    work.authorIds?.forEach((authorId: string) => {
      if (!stats.has(authorId)) {
        stats.set(authorId, {});
      }
      const authorStats = stats.get(authorId)!;
      const type = work.workType || "unknown";
      authorStats[type] = (authorStats[type] || 0) + 1;
    });
  });

  return stats;
}, [works]);

// 2. Replace the author list item rendering (around line 292)
// OLD CODE (remove this):
/*
{authorWorks.length > 0 && (
  <div className="flex items-center gap-1 text-xs text-neutral-400">
    <FileText className="w-3 h-3" />
    <span>{authorWorks.length} work{authorWorks.length !== 1 ? 's' : ''}</span>
  </div>
)}
*/

// NEW CODE (use this):
{
  (() => {
    const workStats = authorWorkStats.get(author.id) || {};
    const totalWorks = Object.values(workStats).reduce(
      (sum, count) => sum + count,
      0
    );

    if (totalWorks === 0) return null;

    const workSummary = Object.entries(workStats)
      .map(([type, count]) => `${count} ${type}${count !== 1 ? "s" : ""}`)
      .join(", ");

    return (
      <div className="mt-3 pt-3 border-t border-neutral-700">
        <p className="text-xs text-neutral-400">{workSummary}</p>
      </div>
    );
  })();
}

// 3. Example output:
// - Author with 2 papers, 1 textbook: "2 papers, 1 textbook"
// - Author with 1 paper: "1 paper"
// - Author with 3 notes: "3 notes"
// - Author with no works: nothing shown

/**
 * Avatar Component Example
 */

interface AvatarProps {
  author: Author;
  size?: "small" | "medium" | "large";
  className?: string;
}

function Avatar({ author, size = "medium", className = "" }: AvatarProps) {
  const sizeClasses = {
    small: "w-8 h-8 text-xs",
    medium: "w-12 h-12 text-sm",
    large: "w-16 h-16 text-base",
  };

  const initials = `${author.firstName[0]}${author.lastName[0]}`.toUpperCase();

  if (author.avatarDisplayPath) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-neutral-800 border-2 border-neutral-700 overflow-hidden flex-shrink-0 ${className}`}
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
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-medium text-white flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}

// Usage in list items:
// <Avatar author={author} size="small" />

/**
 * Card Layout Example
 */

function AuthorCard({ author, workStats, onClick, onEditAvatar }) {
  const totalWorks = Object.values(workStats).reduce(
    (sum, count) => sum + count,
    0
  );

  const workSummary = Object.entries(workStats)
    .map(([type, count]) => `${count} ${type}${count !== 1 ? "s" : ""}`)
    .join(", ");

  return (
    <div
      className="group relative bg-neutral-800 hover:bg-neutral-750 rounded-lg p-4 border border-neutral-700 hover:border-blue-600 transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Avatar with edit button */}
      <div className="relative w-fit mb-3">
        <Avatar author={author} size="large" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditAvatar();
          }}
          className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 hover:bg-blue-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Camera className="w-3 h-3" />
        </button>
      </div>

      {/* Name */}
      <div className="mb-2">
        <h3 className="text-neutral-100 font-medium leading-tight">
          {author.firstName} {author.middleName && `${author.middleName} `}
          {author.lastName}
        </h3>
        {author.title && (
          <p className="text-xs text-neutral-400 font-serif italic mt-0.5">
            {author.title}
          </p>
        )}
      </div>

      {/* Affiliation */}
      {author.affiliation && (
        <div className="flex items-start gap-2 mb-2">
          <Building2 className="w-3 h-3 text-neutral-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-neutral-400 line-clamp-2">
            {author.affiliation}
          </p>
        </div>
      )}

      {/* Works summary - NEW FORMAT */}
      {totalWorks > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-700">
          <p className="text-xs text-neutral-400">{workSummary}</p>
        </div>
      )}

      {/* Contact icons */}
      <div className="mt-3 flex items-center gap-2">
        {author.contact && (
          <div className="p-1 bg-neutral-700 rounded text-neutral-400 hover:text-blue-400 transition-colors">
            <Mail className="w-3 h-3" />
          </div>
        )}
        {author.website && (
          <div className="p-1 bg-neutral-700 rounded text-neutral-400 hover:text-blue-400 transition-colors">
            <Globe className="w-3 h-3" />
          </div>
        )}
      </div>
    </div>
  );
}

// Grid Layout:
// <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
//   {authors.map(author => (
//     <AuthorCard key={author.id} author={author} workStats={authorWorkStats.get(author.id) || {}} onClick={...} onEditAvatar={...} />
//   ))}
// </div>
