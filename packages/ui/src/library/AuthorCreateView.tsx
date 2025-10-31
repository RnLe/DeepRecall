/**
 * AuthorCreateView Component
 *
 * Form for creating a new author
 */

import { useState } from "react";
import type { Author } from "@deeprecall/core";
import { AuthorFormFields, type AuthorFormData } from "./AuthorFormFields";
import { logger } from "@deeprecall/telemetry";

interface AuthorCreateViewProps {
  onBack: () => void;
  onCreate: (data: Partial<Author>) => Promise<Author>;
}

export function AuthorCreateView({ onBack, onCreate }: AuthorCreateViewProps) {
  const [formData, setFormData] = useState<AuthorFormData>({
    firstName: "",
    lastName: "",
    middleName: "",
    titles: [],
    affiliation: "",
    contact: "",
    orcid: "",
    website: "",
    bio: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreate({
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || undefined,
        titles: formData.titles.length > 0 ? formData.titles : undefined,
        affiliation: formData.affiliation || undefined,
        contact: formData.contact || undefined,
        orcid: formData.orcid || undefined,
        website: formData.website || undefined,
        bio: formData.bio || undefined,
      });
      alert("Author created successfully!");
      onBack();
    } catch (error) {
      logger.error("ui", "Failed to create author", { error, formData });
      alert("Failed to create author. Please try again.");
    } finally {
      setIsSubmitting(false);
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
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <AuthorFormFields formData={formData} onChange={setFormData} />

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create Author"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
