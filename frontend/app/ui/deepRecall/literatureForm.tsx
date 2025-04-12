// literatureForm.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  LiteratureType,
  Literature,
  Author,
  LITERATURE_FORM_FIELDS,
  LiteratureFormField,
} from "../../helpers/literatureTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLiterature } from "../../api/literatureService";
import { createAuthor, searchAuthors } from "../../api/authors";

// Local type to track selected authors and whether they’re new
interface SelectedAuthor {
  author: Author;
  isNew: boolean;
}

interface LiteratureFormProps {
  mediaType: LiteratureType;
  className?: string;
  onSuccess?: () => void;
}

const LiteratureForm: React.FC<LiteratureFormProps> = ({ mediaType, className, onSuccess }) => {
  // Common form fields
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  // We'll remove the separate state for each type‐specific field and manage them in one object.
  const [typeFields, setTypeFields] = useState<Record<string, string>>({});

  // Error and loading states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for the Authors field
  const [selectedAuthors, setSelectedAuthors] = useState<SelectedAuthor[]>([]);
  const [authorQuery, setAuthorQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Author[]>([]);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const queryClient = useQueryClient();

  // Initialize type-specific field state whenever mediaType changes.
  useEffect(() => {
    const initialValues: Record<string, string> = {};
    const fields = LITERATURE_FORM_FIELDS[mediaType] || [];
    fields.forEach((field: LiteratureFormField) => {
      initialValues[field.name] = "";
    });
    setTypeFields(initialValues);
  }, [mediaType]);

  // Mutation hook for creating literature
  const createLiteratureMutation = useMutation<
    Literature,
    Error,
    Omit<Literature, "documentId">
  >({
    mutationFn: createLiterature,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literature"] }),
    onError: (error: Error) => {
      console.error("Failed to create literature:", error);
    },
  });

  // Debounce author query and fetch suggestions
  useEffect(() => {
    if (authorQuery.trim() === "") {
      setSuggestions([]);
      return;
    }
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      searchAuthors(authorQuery.trim())
        .then((res) => setSuggestions(res))
        .catch((err) => console.error("Error fetching author suggestions", err));
    }, 300);
  }, [authorQuery]);

  // Add author if not already added
  const addAuthor = (author: Author, isNew = false) => {
    const alreadyAdded = selectedAuthors.some((sa) =>
      !isNew
        ? sa.author.id === author.id
        : sa.author.first_name === author.first_name && sa.author.last_name === author.last_name
    );
    if (alreadyAdded) return;
    setSelectedAuthors([...selectedAuthors, { author, isNew }]);
  };

  // Remove author
  const removeAuthor = (index: number) => {
    const newAuthors = [...selectedAuthors];
    newAuthors.splice(index, 1);
    setSelectedAuthors(newAuthors);
  };

  // Handle Enter key in the author input
  const handleAuthorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (authorQuery.trim() !== "") {
        const parts = authorQuery.trim().split(" ");
        if (parts.length < 2) {
          alert("Please enter at least first and last name.");
          return;
        }
        const last_name = parts.pop()!;
        const first_name = parts.join(" ");
        const newAuthor: Author = { first_name, last_name };
        addAuthor(newAuthor, true);
        setAuthorQuery("");
        setSuggestions([]);
      }
    }
  };

  // Handle type-specific field changes
  const handleFieldChange = (fieldName: string, value: string) => {
    setTypeFields((prev) => ({ ...prev, [fieldName]: value }));
  };

  // Handle form submission: process authors and create literature
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // Process new authors if needed
      const processedAuthors = await Promise.all(
        selectedAuthors.map(async (sa) => (sa.isNew ? await createAuthor(sa.author) : sa.author))
      );

      // Build metadata by merging common subtitle, processed typeFields, authors, and an empty versions array.
      const metadata = {
        subtitle,
        ...typeFields,
        authors: processedAuthors,
        versions: [],
      };

      const payload: Omit<Literature, "documentId"> = {
        title,
        type: mediaType,
        type_metadata: metadata,
      };

      const created = await createLiteratureMutation.mutateAsync(payload);
      console.log("Created entry:", created);

      // Reset fields on success
      setTitle("");
      setSubtitle("");
      setTypeFields({});
      setSelectedAuthors([]);
      setAuthorQuery("");
      setSuggestions([]);

      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`p-4 border rounded shadow mt-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-2">Create new {mediaType}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-300 p-2"
          />
        </div>

        {/* Subtitle (common) */}
        <div>
          <label className="block text-sm font-medium">Subtitle (optional)</label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Enter subtitle..."
            className="mt-1 block w-full border border-gray-300 p-2"
          />
        </div>

        {/* Authors */}
        <div>
          <label className="block text-sm font-medium">Authors</label>
          <input
            type="text"
            value={authorQuery}
            onChange={(e) => setAuthorQuery(e.target.value)}
            onKeyDown={handleAuthorKeyDown}
            placeholder="Type to search or add new author..."
            className="mt-1 block w-full border border-gray-300 p-2"
          />
          {suggestions.length > 0 && (
            <ul className="border border-gray-300 mt-1 max-h-40 overflow-y-auto">
              {suggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  onClick={() => {
                    addAuthor(suggestion, false);
                    setAuthorQuery("");
                    setSuggestions([]);
                  }}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                >
                  <span className="underline">{suggestion.first_name}</span>{" "}
                  <span className="font-bold">{suggestion.last_name}</span>
                </li>
              ))}
            </ul>
          )}
          {/* Display selected authors */}
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedAuthors.map((sa, index) => (
              <div
                key={index}
                className={`flex items-center border border-gray-300 p-2 rounded ${
                  sa.isNew ? "bg-green-100" : "bg-white"
                }`}
              >
                <div>
                  <span className="underline">{sa.author.first_name}</span>{" "}
                  <span className="font-bold">{sa.author.last_name}</span>
                </div>
                <button type="button" onClick={() => removeAuthor(index)} className="ml-2">
                  x
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Render type-specific fields dynamically */}
        {LITERATURE_FORM_FIELDS[mediaType]?.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium">
              {field.label}
              {field.required && " *"}
            </label>
            {field.type === "textarea" ? (
              <textarea
                value={typeFields[field.name] || ""}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            ) : (
              <input
                type={field.type}
                value={typeFields[field.name] || ""}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                className="mt-1 block w-full border border-gray-300 p-2"
                required={field.required}
              />
            )}
          </div>
        ))}

        {errorMsg && <p className="text-red-500">{errorMsg}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`bg-green-500 text-white px-4 py-2 rounded ${
            isSubmitting ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isSubmitting ? "Creating…" : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default LiteratureForm;
