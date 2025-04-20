// src/components/pdfViewer/TagInput.tsx
import React, { useState, useRef, useEffect } from "react";
import { AnnotationTag } from "../../types/annotationTypes";
import { useAnnotationTags } from "../../customHooks/useAnnotationTags";

interface TagInputProps {
  tags: AnnotationTag[];
  onChange: (tags: AnnotationTag[]) => void;
}

export default function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const { tags: suggestions, isLoading, createTag: ensureTag } = useAnnotationTags(input);
  const containerRef = useRef<HTMLDivElement>(null);

  // close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addTag = async (name: string) => {
    if (!name.trim() || tags.some((t) => t.name === name)) return;
    const tag = await ensureTag(name);
    onChange([...tags, tag]);
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const val = input.trim();
      setInput("");
      await addTag(val);
      setOpen(false);
    }
    // removed Backspace branch so Backspace no longer removes last tag
  };

  const handleSelectSuggestion = async (tag: AnnotationTag) => {
    onChange([...tags, tag]);
    setInput("");
    setOpen(false);
  };

  const removeTag = (idx: number) => {
    const out = tags.slice();
    out.splice(idx, 1);
    onChange(out);
  };

  // derive filtered suggestions
  const filteredSuggestions = suggestions.filter(
    (s) => !tags.some((t) => t.documentId === s.documentId)
  );

  return (
    <div className="relative" ref={containerRef}>
      <input
        className="w-full p-1 bg-gray-800 border border-gray-600 rounded text-sm text-white"
        value={input}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const v = e.target.value.replace(/[\s,]/g, "");
          setInput(v);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Add tag…"
      />
      <div className="flex flex-wrap gap-1 mt-2">
        {tags.map((t, i) => (
          <span
            key={t.documentId || t.name}
            className="flex items-center px-2 py-1 bg-gray-700 rounded text-sm"
          >
            {t.name}
            <button
              onClick={() => removeTag(i)}
              className="ml-1 text-gray-400 hover:text-white"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* suggestions dropdown */}
      {open && input && (
        <ul className="absolute z-10 w-full max-h-40 overflow-auto bg-gray-800 border border-gray-600 rounded mt-1">
          {isLoading ? (
            <li className="p-2 text-sm text-gray-400">Loading…</li>
          ) : filteredSuggestions.length ? (
            filteredSuggestions.map((s) => (
              <li
                key={s.documentId}
                className="px-2 py-1 cursor-pointer hover:bg-gray-700 text-sm"
                onClick={() => handleSelectSuggestion(s)}
              >
                {s.name}
              </li>
            ))
          ) : (
            <li
              className="px-2 py-1 cursor-pointer hover:bg-gray-700 text-sm"
              onClick={async () => {
                await addTag(input);
                setOpen(false);
              }}
            >
              Create “{input}”
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
