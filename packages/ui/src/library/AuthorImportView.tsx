/**
 * AuthorImportView Component
 *
 * Import authors from BibTeX
 */

import { useState } from "react";
import type { Author } from "@deeprecall/core";

interface ParsedAuthor {
  firstName: string;
  lastName: string;
  middleName?: string;
  orcid?: string;
}

interface AuthorImportViewProps {
  bibtexInput: string;
  onBibtexChange: (value: string) => void;
  onBack: () => void;
  onImport: (data: Partial<Author>) => Promise<Author>;
  parseAuthorList: (input: string) => ParsedAuthor[];
  getAuthorFullName: (author: Author) => string;
}

export function AuthorImportView({
  bibtexInput,
  onBibtexChange,
  onBack,
  onImport,
  parseAuthorList,
  getAuthorFullName,
}: AuthorImportViewProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<string[]>([]);

  const handleImport = async () => {
    if (!bibtexInput.trim()) {
      alert("Please paste BibTeX code");
      return;
    }

    setIsImporting(true);
    setImportResults([]);

    try {
      // Extract author field from BibTeX
      const authorMatch = bibtexInput.match(/author\s*=\s*[{"]([^}"]+)[}"]/i);

      if (!authorMatch) {
        alert("No author field found in BibTeX code");
        return;
      }

      const authorString = authorMatch[1];
      const parsedAuthors = parseAuthorList(authorString);

      const results: string[] = [];

      for (const parsed of parsedAuthors) {
        try {
          const author = await onImport({
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            middleName: parsed.middleName,
            orcid: parsed.orcid,
          });
          results.push(`✓ ${getAuthorFullName(author)}`);
        } catch (error) {
          results.push(`✗ Failed: ${parsed.firstName} ${parsed.lastName}`);
        }
      }

      setImportResults(results);

      if (results.every((r) => r.startsWith("✓"))) {
        setTimeout(() => {
          alert(`Successfully imported ${parsedAuthors.length} author(s)!`);
          onBack();
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to import:", error);
      alert("Failed to import authors. Please check the BibTeX format.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <div className="shrink-0 px-6 py-3 border-b border-neutral-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to list
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="p-4 bg-blue-950/20 border border-blue-900/30 rounded-lg">
            <p className="text-sm text-blue-200">
              Paste BibTeX code containing an{" "}
              <code className="px-1 bg-blue-900/30 rounded">author</code> field.
              The system will extract and parse all authors, creating or
              updating them as needed.
            </p>
            <p className="text-xs text-blue-300/60 mt-2">
              Example:{" "}
              <code className="px-1 bg-blue-900/30 rounded">
                author = {"{"}"von Neumann, John and Turing, Alan M.{"}"}
              </code>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              BibTeX Code
            </label>
            <textarea
              value={bibtexInput}
              onChange={(e) => onBibtexChange(e.target.value)}
              placeholder="Paste BibTeX entry here..."
              rows={10}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {importResults.length > 0 && (
            <div className="p-4 bg-neutral-800 border border-neutral-700 rounded-lg">
              <h3 className="text-sm font-semibold text-neutral-300 mb-2">
                Import Results:
              </h3>
              <div className="space-y-1">
                {importResults.map((result, i) => (
                  <div
                    key={i}
                    className={`text-sm ${
                      result.startsWith("✓")
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || !bibtexInput.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isImporting ? "Importing..." : "Import Authors"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
