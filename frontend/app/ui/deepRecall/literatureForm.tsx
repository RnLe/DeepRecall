// literatureForm.tsx

import React, { useState, useEffect } from "react";
import { Literature, LiteratureType } from "../../helpers/literatureTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLiterature } from "../../api/literatureService";

interface LiteratureFormProps {
  literatureType: LiteratureType;
  className?: string;
  onSuccess?: () => void;
}

const LiteratureForm: React.FC<LiteratureFormProps> = ({
  literatureType,
  className,
  onSuccess,
}) => {
  // Only the title is required as a top-level field.
  const [title, setTitle] = useState("");
  // additionalFields holds the user-modifiable copy of the type template.
  const [additionalFields, setAdditionalFields] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  // Whenever the literatureType changes, parse its metadata template.
  useEffect(() => {
    try {
      let template;
      if (typeof literatureType.typeMetadata === "string") {
        template = literatureType.typeMetadata 
          ? JSON.parse(literatureType.typeMetadata) 
          : {};
      } else {
        template = literatureType.typeMetadata || {};
      }
      if (template.versions !== undefined) {
        delete template.versions;
      }
      setAdditionalFields(template);
    } catch (err) {
      setAdditionalFields({});
      console.error("Error parsing literature type metadata:", err);
    }
  }, [literatureType]);

  // Mutation hook for creating literature.
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

  // Helper to update additionalFields state.
  const handleAdditionalFieldChange = (key: string, value: any) => {
    setAdditionalFields((prev) => ({ ...prev, [key]: value }));
  };

  // Render input for an additional attribute depending on its type.
  // For the "versionsAreEqual" field, it is rendered as read-only.
  const renderAdditionalField = (key: string, value: any) => {
    if (key === "versionsAreEqual") {
      return additionalFields[key] ? "True" : "False";
    }
    if (Array.isArray(value)) {
      return (
        <select
          value={additionalFields[key]}
          onChange={(e) => handleAdditionalFieldChange(key, e.target.value)}
          className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
        >
          <option value="">Select an option</option>
          {value.map((option: string | number, idx: number) => (
            <option key={idx} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    } else if (typeof value === "number") {
      return (
        <input
          type="number"
          value={additionalFields[key]}
          onChange={(e) => handleAdditionalFieldChange(key, Number(e.target.value))}
          className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
        />
      );
    } else {
      return (
        <input
          type="text"
          value={additionalFields[key]}
          onChange={(e) => handleAdditionalFieldChange(key, e.target.value)}
          className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
        />
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // Build metadata by merging the template (as modifiable additionalFields)
      // Versions are not included since they belong in metadata.
      const metadataPayload = { ...additionalFields };

      const payload: Omit<Literature, "documentId"> = {
        title,
        type: literatureType.name,
        metadata: JSON.stringify(metadataPayload),
      };

      await createLiteratureMutation.mutateAsync(payload);
      setTitle("");
      // Optionally, reset additional fields to the template's original values.
      setAdditionalFields({});
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`p-4 border rounded shadow mt-4 bg-gray-800 text-white ${className}`}>
      <h3 className="text-lg font-semibold mb-2">
         Create New {literatureType.name.charAt(0).toUpperCase() + literatureType.name.slice(1)}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title Field */}
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
          />
        </div>

        {/* Additional type-specific attributes from the metadata template */}
        <div className="p-4 border border-gray-600 rounded">
          <h4 className="text-md font-semibold mb-2">
            Additional type-specific attributes
          </h4>
          {Object.keys(additionalFields).length === 0 ? (
            <p className="text-gray-400">No additional attributes defined</p>
          ) : (
            Object.entries(additionalFields).map(([key, value]) => (
              <div key={key} className="mb-4">
                <label className="block text-sm font-medium text-gray-300 capitalize">
                  {key}
                </label>
                {renderAdditionalField(key, value)}
              </div>
            ))
          )}
        </div>

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
