/**
 * AuthorInput Component
 *
 * Smart author selection/creation with:
 * - Autocomplete search for existing authors
 * - Inline creation of new authors
 * - Smart name parsing with auto-capitalization
 * - ORCID support
 * - Multi-author management with ordering
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus, User, Search } from "lucide-react";
import {
  useAuthorAutocomplete,
  useFindOrCreateAuthor,
} from "@/src/hooks/useAuthors";
import { parseAuthorList, formatAuthorName } from "@/src/utils/nameParser";
import { getAuthorFullName, type Author } from "@/src/schema/library";

interface AuthorInputProps {
  value: string[]; // Array of author IDs
  authors: Author[]; // Full author objects (from useAuthorsByIds)
  onChange: (authorIds: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function AuthorInput({
  value,
  authors,
  onChange,
  placeholder = "Search or add authors...",
  className = "",
}: AuthorInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { searchQuery, setSearchQuery, results, isLoading } =
    useAuthorAutocomplete({
      limit: 10,
      debounceMs: 200,
    });

  const findOrCreateMutation = useFindOrCreateAuthor();

  // Update search query when input changes
  useEffect(() => {
    setSearchQuery(inputValue);
  }, [inputValue, setSearchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectAuthor = (author: Author) => {
    if (!value.includes(author.id)) {
      onChange([...value, author.id]);
    }
    setInputValue("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveAuthor = (authorId: string) => {
    onChange(value.filter((id) => id !== authorId));
  };

  const handleCreateAuthor = async () => {
    if (!inputValue.trim()) return;

    try {
      // Parse the input - could be single or multiple authors
      const parsedAuthors = parseAuthorList(inputValue);

      for (const parsed of parsedAuthors) {
        // Find or create each author
        const author = await findOrCreateMutation.mutateAsync({
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          middleName: parsed.middleName,
          orcid: parsed.orcid,
        });

        // Add to selected authors if not already there
        if (!value.includes(author.id)) {
          onChange([...value, author.id]);
        }
      }

      setInputValue("");
      setIsOpen(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error("Failed to create author:", error);
      alert("Failed to create author. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();

      // If there's a result selected or only one result, use it
      if (results.length === 1) {
        handleSelectAuthor(results[0]);
      } else if (inputValue.trim()) {
        // Otherwise create new author(s)
        handleCreateAuthor();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setInputValue("");
    }
  };

  // Filter results to exclude already selected authors
  const filteredResults = results.filter(
    (author) => !value.includes(author.id)
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Selected Authors */}
      {authors.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {authors.map((author) => (
            <div
              key={author.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-600/30 text-blue-200 rounded-lg text-sm"
            >
              <User className="w-3.5 h-3.5" />
              <span>{getAuthorFullName(author)}</span>
              {author.orcid && (
                <span className="text-blue-400 text-xs">({author.orcid})</span>
              )}
              <button
                type="button"
                onClick={() => handleRemoveAuthor(author.id)}
                className="ml-1 p-0.5 hover:bg-blue-600/30 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Dropdown */}
        {isOpen && (inputValue.trim() || results.length > 0) && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl max-h-64 overflow-y-auto"
          >
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-neutral-400 text-center">
                Searching...
              </div>
            ) : (
              <>
                {/* Existing authors */}
                {filteredResults.length > 0 && (
                  <div className="border-b border-neutral-700">
                    <div className="px-3 py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                      Existing Authors
                    </div>
                    {filteredResults.map((author) => (
                      <button
                        key={author.id}
                        type="button"
                        onClick={() => handleSelectAuthor(author)}
                        className="w-full px-4 py-2.5 text-left hover:bg-neutral-700 transition-colors border-t border-neutral-750"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-neutral-100">
                              {getAuthorFullName(author)}
                            </div>
                            {author.affiliation && (
                              <div className="text-xs text-neutral-400 mt-0.5">
                                {author.affiliation}
                              </div>
                            )}
                          </div>
                          {author.orcid && (
                            <div className="text-xs text-blue-400 font-mono">
                              {author.orcid}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Create new author option */}
                {inputValue.trim() && (
                  <div>
                    <div className="px-3 py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                      {filteredResults.length > 0
                        ? "Or Create New"
                        : "Create New Author"}
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateAuthor}
                      className="w-full px-4 py-2.5 text-left hover:bg-neutral-700 transition-colors border-t border-neutral-750"
                      disabled={findOrCreateMutation.isPending}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-emerald-600/20 border border-emerald-600/30 rounded-full">
                          <Plus className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-neutral-100">
                            Create:{" "}
                            {parseAuthorList(inputValue)
                              .map((a) => formatAuthorName(a))
                              .join(", ")}
                          </div>
                          <div className="text-xs text-neutral-400 mt-0.5">
                            {parseAuthorList(inputValue).length > 1
                              ? `Add ${parseAuthorList(inputValue).length} new authors`
                              : "Add as new author"}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {/* No results */}
                {filteredResults.length === 0 && !inputValue.trim() && (
                  <div className="px-4 py-8 text-sm text-neutral-400 text-center">
                    <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Start typing to search or add authors</p>
                    <p className="text-xs mt-1">
                      Supports "First Last" or "Last, First" format
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="text-xs text-neutral-500">
        Tip: Use "and" to add multiple authors at once (e.g., "Smith, John and
        Doe, Jane")
      </div>
    </div>
  );
}
