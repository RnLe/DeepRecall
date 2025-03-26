// literatureForm.tsx
import React, { useState, useEffect, useRef } from "react";
import { LiteratureType, Literature, TextbookMetadata, PaperMetadata, ScriptMetadata, ThesisMetadata, Author } from "../helpers/literatureTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLiterature } from "../api/literatureService";
import { createAuthor, searchAuthors } from "../api/authors";

// Local type to keep track of selected authors and whether they’re new
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

  // Textbook-specific fields
  const [description, setDescription] = useState("");
  const [isbn, setIsbn] = useState("");
  const [doi, setDoi] = useState("");

  // Paper-specific fields
  const [journal, setJournal] = useState("");

  // Thesis-specific fields
  const [institution, setInstitution] = useState("");
  const [advisor, setAdvisor] = useState("");

  // Error and loading states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for the Authors field
  const [selectedAuthors, setSelectedAuthors] = useState<SelectedAuthor[]>([]);
  const [authorQuery, setAuthorQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Author[]>([]);
  // Ref for debouncing
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get react-query's queryClient instance
  const queryClient = useQueryClient();

  // Use a unified mutation hook for creating literature
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

  // Debounce the author query and fetch suggestions from the API
  useEffect(() => {
    if (authorQuery.trim() === "") {
      setSuggestions([]);
      return;
    }
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      searchAuthors(authorQuery.trim())
        .then((res) => {
          setSuggestions(res);
        })
        .catch((err) => {
          console.error("Error fetching author suggestions", err);
        });
    }, 300);
  }, [authorQuery]);

  // Add author to the selected list if not already added
  const addAuthor = (author: Author, isNew = false) => {
    const alreadyAdded = selectedAuthors.some((sa) =>
      !isNew
        ? sa.author.id === author.id
        : sa.author.first_name === author.first_name && sa.author.last_name === author.last_name
    );
    if (alreadyAdded) return;
    setSelectedAuthors([...selectedAuthors, { author, isNew }]);
  };

  // Remove author from the selected list
  const removeAuthor = (index: number) => {
    const newAuthors = [...selectedAuthors];
    newAuthors.splice(index, 1);
    setSelectedAuthors(newAuthors);
  };

  // Handle Enter key in the author input to add a new author if needed
  const handleAuthorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (authorQuery.trim() !== "") {
        // Parse the input: all words except the last form first_name; last word is last_name
        const parts = authorQuery.trim().split(" ");
        if (parts.length < 2) {
          // Enforce rule: require at least two words (first and last name)
          alert("Please enter at least first and last name.");
          return;
        }
        const last_name = parts.pop()!;
        const first_name = parts.join(" ");
        // Create a temporary author object (id is undefined for new entries)
        const newAuthor: Author = {
          first_name,
          last_name,
        };
        addAuthor(newAuthor, true);
        setAuthorQuery("");
        setSuggestions([]);
      }
    }
  };

  // Handle form submission including processing new authors
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // Process new authors: create them in the database if needed
      const processedAuthors = await Promise.all(
        selectedAuthors.map(async (sa) => {
          if (sa.isNew) {
            const created = await createAuthor(sa.author);
            return created;
          }
          return sa.author;
        })
      );

      // Build the literature payload using unified types.
      // Authors will be stored in the metadata.
      let payload: Omit<Literature, "documentId"> = {
        title,
        type: mediaType,
        type_metadata: {} as TextbookMetadata | PaperMetadata | ScriptMetadata | ThesisMetadata,
      };

      // Build type-specific metadata:
      if (mediaType === "Textbook") {
        const meta: TextbookMetadata = {
          subtitle,
          description,
          isbn,
          doi,
          authors: processedAuthors,
          versions: [] // Start with no versions.
        };
        payload.type_metadata = meta;
      } else if (mediaType === "Paper") {
        const meta: PaperMetadata = {
          subtitle,
          journal,
          doi,
          authors: processedAuthors,
          versions: []
        };
        payload.type_metadata = meta;
      } else if (mediaType === "Script") {
        const meta: ScriptMetadata = {
          subtitle,
          authors: processedAuthors,
          versions: []
        };
        payload.type_metadata = meta;
      } else if (mediaType === "Thesis") {
        const meta: ThesisMetadata = {
          subtitle,
          institution,
          advisor,
          authors: processedAuthors,
          versions: []
        };
        payload.type_metadata = meta;
      } else {
        throw new Error("Unsupported media type");
      }

      const created = await createLiteratureMutation.mutateAsync(payload);
      console.log("Created entry:", created);
      // Reset form fields on success
      setTitle("");
      setSubtitle("");
      setDescription("");
      setIsbn("");
      setDoi("");
      setJournal("");
      setInstitution("");
      setAdvisor("");
      setSelectedAuthors([]);
      setAuthorQuery("");
      setSuggestions([]);

      if (onSuccess) {
        onSuccess();
      }
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
        {/* Title input */}
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

        {/* Subtitle input */}
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

        {/* Authors input */}
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
                  <span className="underline">{suggestion.first_name}</span>
                  <span className="font-bold"> {suggestion.last_name}</span>
                </li>
              ))}
            </ul>
          )}
          {/* Display selected authors as cards */}
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedAuthors.map((sa, index) => (
              <div
                key={index}
                className={`flex items-center border border-gray-300 p-2 rounded ${sa.isNew ? "bg-green-100" : "bg-white"}`}
              >
                <div>
                  <span className="underline">{sa.author.first_name}</span>
                  <span className="font-bold"> {sa.author.last_name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAuthor(index)}
                  className="ml-2"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Type-specific inputs */}
        {mediaType === "Textbook" && (
          <>
            <div>
              <label className="block text-sm font-medium">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">ISBN (optional)</label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">DOI (optional)</label>
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
          </>
        )}

        {mediaType === "Paper" && (
          <>
            <div>
              <label className="block text-sm font-medium">Journal (optional)</label>
              <input
                type="text"
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">DOI (optional)</label>
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
          </>
        )}

        {mediaType === "Thesis" && (
          <>
            <div>
              <label className="block text-sm font-medium">Institution</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Advisor</label>
              <input
                type="text"
                value={advisor}
                onChange={(e) => setAdvisor(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
          </>
        )}

        {/* No additional fields required for Script */}

        {errorMsg && <p className="text-red-500">{errorMsg}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`bg-green-500 text-white px-4 py-2 rounded ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isSubmitting ? "Creating…" : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default LiteratureForm;
