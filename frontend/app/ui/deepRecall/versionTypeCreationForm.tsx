import React, { useState } from "react";

type FieldType = "string" | "number" | "dropdown";
interface CustomField {
  id: string;
  name: string;
  type: FieldType;
  options?: string[];
}

interface FormProps {
  className?: string;
  literatureTypeName: string;
  onSubmit: (payload: { versionMetadata: string; name: string }) => void;
  onCancel?: () => void;
}

// core definitions
const coreDefs: Record<string, { type: FieldType; default: any }> = {
  publishingDate: { type: "string", default: "" },
  versionTitle: { type: "string", default: "" },
  editionNumber: { type: "number", default: 0 },
  versionNumber: { type: "number", default: 0 },
};

const VersionTypeCreationForm: React.FC<FormProps> = ({ className, literatureTypeName, onSubmit, onCancel }) => {
  // Name is prefilled by literatureTypeName prop

  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.keys(coreDefs).reduce((a, k) => ({ ...a, [k]: false }), {})
  );
  const [custom, setCustom] = useState<CustomField[]>([]);

  const toggle = (k: string) => setEnabled((e) => ({ ...e, [k]: !e[k] }));
  const addCustom = () => {
    setCustom((c) => [...c, { id: Date.now().toString(), name: "", type: "string" }]);
  };
  const updateCustom = (id: string, v: Partial<CustomField>) => {
    setCustom((c) => c.map((f) => (f.id === id ? { ...f, ...v } : f)));
  };
  const removeCustom = (id: string) => setCustom((c) => c.filter((f) => f.id !== id));

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    const tpl: any = {};
    Object.keys(enabled).forEach((k) => enabled[k] && (tpl[k] = coreDefs[k].default));
    custom.forEach((f) => {
      if (!f.name.trim()) return;
      if (f.type === "dropdown" && f.options && f.options.length >= 2)
        tpl[f.name] = f.options;
      else if (f.type !== "dropdown")
        tpl[f.name] = coreDefs[f.name]?.default ?? (f.type === "number" ? 0 : "");
    });
    onSubmit({ versionMetadata: JSON.stringify(tpl), name: literatureTypeName });
  };

  return (
    <div className={`p-4 border rounded shadow mt-4 bg-gray-800 text-white ${className} overflow-y-auto max-h-[90vh]`}>  
      <h3 className="text-lg font-semibold mb-4">
        Create New Version Type for: {literatureTypeName} <span className="text-red-500">*</span>
      </h3>
      <form onSubmit={handle} className="space-y-6">
        {/* Name is fixed to literatureTypeName */}
        <div className="border p-4 rounded">
          <h4 className="text-md font-semibold mb-2">Core Fields</h4>
          {Object.keys(coreDefs).map((k) => (
            <div key={k} className="flex items-center mb-2">
              <button
                type="button"
                onClick={() => toggle(k)}
                className={enabled[k] ? "bg-green-600" : "bg-gray-700"}
              >
                {enabled[k] ? "On" : "Off"}
              </button>
              <span className="ml-2">
                {k} ({coreDefs[k].type})
              </span>
            </div>
          ))}
        </div>
        <div className="border p-4 rounded mt-4">
          <h4 className="text-md font-semibold mb-2">Custom Fields</h4>
          {custom.map((f) => (
            <div key={f.id} className="mb-4 border-b pb-2">
              <input
                placeholder="Name"
                value={f.name}
                onChange={(e) => updateCustom(f.id, { name: e.target.value })}
                className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
              />
              <select
                value={f.type}
                onChange={(e) =>
                  updateCustom(f.id, {
                    type: e.target.value as FieldType,
                    options: e.target.value === "dropdown" ? ["", ""] : undefined,
                  })
                }
                className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="dropdown">Dropdown</option>
              </select>
              <button type="button" onClick={() => removeCustom(f.id)}>
                X
              </button>
              {f.type === "dropdown" &&
                f.options?.map((opt, i) => (
                  <input
                    key={i}
                    value={opt}
                    onChange={(e) => {
                      const opts = [...(f.options || [])];
                      opts[i] = e.target.value;
                      updateCustom(f.id, { options: opts });
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
                  />
                ))}
              {f.type === "dropdown" && (
                <button
                  type="button"
                  onClick={() => {
                    if ((f.options || []).length < 10)
                      updateCustom(f.id, { options: [...(f.options || []), ""] });
                  }}
                >
                  + Add Option
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addCustom}>
            + Add Custom Field
          </button>
        </div>
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
            className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-lg font-medium hover:from-emerald-700 hover:to-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Create Version Type
          </button>
        </div>
      </form>
    </div>
  );
};

export default VersionTypeCreationForm;