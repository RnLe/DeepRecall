// literatureForm.tsx

import React, { useState } from "react";
import { MediaType } from "../helpers/mediaTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTextbook, Textbook } from "../api/textbooks";
import { createPaper, Paper } from "../api/papers";
import { createScript, Script } from "../api/scripts";

interface LiteratureFormProps {
  mediaType: MediaType;
  className?: string;
}

const LiteratureForm: React.FC<LiteratureFormProps> = ({ mediaType, className }) => {
    // State for common field: title
    const [title, setTitle] = useState("");
    // State for Textbook-specific fields
    const [description, setDescription] = useState("");
    const [isbn, setIsbn] = useState("");
    const [doi, setDoi] = useState("");
    // State for Paper-specific fields
    const [journal, setJournal] = useState("");
    // Error and loading states
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get react-query's queryClient instance
    const queryClient = useQueryClient();

    // Define mutation hooks for each media type
    const createTextbookMutation = useMutation<
        Textbook, // Rückgabetyp der Mutation
        Error,    // Fehler-Typ
        Omit<Textbook, "id"> // Variablentyp (Payload) der Mutation
        >({
          mutationFn: createTextbook,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literature"] }),
        onError: (error: Error) => {
            console.error("Failed to create textbook:", error);
        },
    });


    const createPaperMutation = useMutation<
        Paper,
        Error,
        Omit<Paper, "id">
    >({
        mutationFn: createPaper,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literature"] }),
        onError: (error: Error) => {
        console.error("Failed to create paper:", error);
        },
    });
    
    const createScriptMutation = useMutation<
        Script,
        Error,
        Omit<Script, "id">
    >({
        mutationFn: createScript,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literature"] }),
        onError: (error: Error) => {
        console.error("Failed to create script:", error);
        },
    });
  

    // Handle form submission using the correct mutation
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorMsg(null);
        setIsSubmitting(true);
    
        try {
        let created;
        switch (mediaType) {
            case "Textbook": {
            // Create a payload object with the required fields
            const textbookPayload: Omit<Textbook, "id"> = {
                title,
                description,
                isbn,
                doi,
            };
            created = await createTextbookMutation.mutateAsync(textbookPayload);
            break;
            }
            case "Paper": {
            const paperPayload: Omit<Paper, "id"> = {
                title,
                journal,
                doi,
            };
            created = await createPaperMutation.mutateAsync(paperPayload);
            break;
            }
            case "Script": {
            const scriptPayload: Omit<Script, "id"> = { title };
            created = await createScriptMutation.mutateAsync(scriptPayload);
            break;
            }
            default:
            throw new Error("Unsupported media type");
        }
        console.log("Created entry:", created);
        // Reset form fields on success
        setTitle("");
        setDescription("");
        setIsbn("");
        setDoi("");
        setJournal("");
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

            {/* Textbook-specific inputs */}
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

            {/* Paper-specific inputs */}
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

            {/* No additional fields required for Script */}

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
