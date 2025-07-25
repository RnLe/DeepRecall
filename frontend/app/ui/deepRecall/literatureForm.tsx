// literatureForm.tsx

import React, { useState, useEffect } from "react";
import { Literature, LiteratureType } from "../../types/deepRecall/strapi/literatureTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLiterature } from "../../api/literatureService";

interface LiteratureFormProps {
  literatureType: LiteratureType;
  className?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const LiteratureForm: React.FC<LiteratureFormProps> = ({
  literatureType,
  className,
  onSuccess,
  onCancel,
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
      // initialize array fields with empty string to ensure <select> gets a scalar value
      const initFields: Record<string, any> = {};
      Object.entries(template).forEach(([k, v]) => {
        initFields[k] = Array.isArray(v) ? "" : v;
      });
      setAdditionalFields(initFields);
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
      return (
        <div className="px-3 py-2 bg-slate-700/30 border border-slate-600/30 rounded-lg text-slate-300">
          {additionalFields[key] ? "True" : "False"}
        </div>
      );
    }
    if (Array.isArray(value)) {
      return (
        <select
          value={additionalFields[key]}
          onChange={(e) => handleAdditionalFieldChange(key, e.target.value)}
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
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
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
        />
      );
    } else {
      return (
        <input
          type="text"
          value={additionalFields[key]}
          onChange={(e) => handleAdditionalFieldChange(key, e.target.value)}
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
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
    <div className={className}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Field */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Enter literature title..."
            className="w-full px-3 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          />
        </div>

        {/* Additional type-specific attributes from the metadata template */}
        {Object.keys(additionalFields).length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-1 h-4 bg-gradient-to-b from-emerald-500 to-blue-600 rounded-full"></div>
              <h4 className="text-md font-semibold text-slate-200">
                Type-specific Attributes
              </h4>
            </div>
            
            <div className="space-y-4 pl-4 border-l border-slate-700/50">
              {Object.entries(additionalFields).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  {renderAdditionalField(key, value)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-950/20 border border-red-900/20 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <p className="text-red-400 text-sm">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700/50">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
              isSubmitting || !title.trim()
                ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-600 to-blue-600 text-white hover:from-emerald-700 hover:to-blue-700 shadow-sm hover:shadow-md"
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Creating...</span>
              </div>
            ) : (
              `Create ${literatureType.name.charAt(0).toUpperCase() + literatureType.name.slice(1)}`
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LiteratureForm;
