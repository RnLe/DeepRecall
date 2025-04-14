// literatureTypeCreationForm.tsx

import React, { useState, useEffect } from "react";

type CustomFieldType = "string" | "number" | "dropdown";

interface CustomField {
  id: string;
  fieldName: string;
  fieldType: CustomFieldType;
  dropdownOptions?: string[];
}

interface LiteratureTypeCreationFormProps {
  className?: string;
  onSubmit: (payload: { name: string; typeMetadata: string }) => void;
}

// Define the preset core (native) fields with their types and defaults.
const coreFieldDefinitions: Record<string, { type: string; default: any }> = {
  subtitle: { type: "string", default: "" },
  publisher: { type: "string", default: "" },
  authors: { type: "string[]", default: [] },
  journal: { type: "string", default: "" },
  doi: { type: "string", default: "" },
  versionsAreEqual: { type: "boolean", default: false },
};

const LiteratureTypeCreationForm: React.FC<LiteratureTypeCreationFormProps> = ({
  className,
  onSubmit,
}) => {
  // State for the literature type name.
  const [typeName, setTypeName] = useState("");

  // State for core (native) fields: whether to include each one.
  // For all but versionsAreEqual, use a toggle; versionsAreEqual will always be included.
  const [coreFieldsEnabled, setCoreFieldsEnabled] = useState<Record<string, boolean>>({
    subtitle: false,
    publisher: false,
    authors: false,
    journal: false,
    doi: false,
    // For versionsAreEqual, ignore the toggle – always include it.
    versionsAreEqual: true,
  });
  // For the versionsAreEqual field, store its value; default false.
  const [versionsAreEqualValue, setVersionsAreEqualValue] = useState<boolean>(false);

  // State for custom fields.
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Update a core field's enabled state for non-versionsAreEqual fields.
  const toggleCoreField = (key: string) => {
    if (key === "versionsAreEqual") return; // Do nothing for versionsAreEqual.
    setCoreFieldsEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Custom field functions.
  const addCustomField = () => {
    const newField: CustomField = {
      id: Date.now().toString(),
      fieldName: "",
      fieldType: "string",
    };
    setCustomFields((prev) => [...prev, newField]);
  };

  const updateCustomField = (id: string, field: Partial<CustomField>) => {
    setCustomFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...field } : f))
    );
  };

  const removeCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  // For dropdown options: add an option (max 10).
  const addDropdownOption = (id: string) => {
    setCustomFields((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const currentOptions = f.dropdownOptions || ["", ""];
          if (currentOptions.length < 10) {
            return { ...f, dropdownOptions: [...currentOptions, ""] };
          }
        }
        return f;
      })
    );
  };

  const updateDropdownOption = (fieldId: string, index: number, newValue: string) => {
    setCustomFields((prev) =>
      prev.map((f) => {
        if (f.id === fieldId && f.dropdownOptions) {
          const updatedOptions = [...f.dropdownOptions];
          updatedOptions[index] = newValue;
          return { ...f, dropdownOptions: updatedOptions };
        }
        return f;
      })
    );
  };

  // Build and submit the final payload.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!typeName.trim()) {
      alert("Type name is required");
      return;
    }

    // Build the payload template.
    const payloadTemplate: Record<string, any> = {};

    // For each core field:
    Object.keys(coreFieldDefinitions).forEach((key) => {
      if (key === "versionsAreEqual") {
        // Always include versionsAreEqual with its chosen value.
        payloadTemplate[key] = versionsAreEqualValue;
      } else if (coreFieldsEnabled[key]) {
        payloadTemplate[key] = coreFieldDefinitions[key].default;
      }
    });

    // Build template for custom fields.
    const customTemplate: Record<string, any> = {};
    customFields.forEach((field) => {
      if (field.fieldName.trim()) {
        if (field.fieldType === "string") {
          customTemplate[field.fieldName] = "";
        } else if (field.fieldType === "number") {
          customTemplate[field.fieldName] = 0;
        } else if (field.fieldType === "dropdown") {
          if (
            field.dropdownOptions &&
            field.dropdownOptions.filter((opt) => opt.trim() !== "").length >= 2
          ) {
            customTemplate[field.fieldName] = field.dropdownOptions.filter(
              (opt) => opt.trim() !== ""
            );
          } else {
            console.warn(
              `Dropdown field "${field.fieldName}" does not have enough options; skipping.`
            );
          }
        }
      }
    });

    // Merge core and custom templates.
    const typeMetadata = { ...payloadTemplate, ...customTemplate };

    const finalPayload = {
      name: typeName.trim(),
      typeMetadata: JSON.stringify(typeMetadata),
    };

    onSubmit(finalPayload);
  };

  return (
    <div
      className={`p-4 border rounded shadow mt-4 bg-gray-800 text-white ${className} overflow-y-auto max-h-[90vh]`}
    >
      <h3 className="text-lg font-semibold mb-4">
        Create New Literature Type <span className="text-red-500">*</span>
      </h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Type Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={typeName}
            onChange={(e) => setTypeName(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
          />
        </div>

        {/* Core Fields Section */}
        <div className="border p-4 rounded">
          <h4 className="text-md font-semibold mb-2">Core Fields</h4>
          {Object.keys(coreFieldDefinitions).map((key) => {
            const def = coreFieldDefinitions[key];
            // For versionsAreEqual, always render the True/False buttons.
            if (key === "versionsAreEqual") {
              return (
                <div key={key} className="mb-4 flex items-center space-x-4">
                  <span className="capitalize text-sm">
                    {key} ({def.type})
                  </span>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setVersionsAreEqualValue(true)}
                      className={`px-2 py-1 border rounded text-xs ${
                        versionsAreEqualValue
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      True
                    </button>
                    <button
                      type="button"
                      onClick={() => setVersionsAreEqualValue(false)}
                      className={`px-2 py-1 border rounded text-xs ${
                        !versionsAreEqualValue
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      False
                    </button>
                  </div>
                </div>
              );
            } else {
              // For all other core fields, display a toggle button (on/off)
              return (
                <div key={key} className="mb-4 flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => toggleCoreField(key)}
                    className={`px-2 py-1 border rounded text-sm ${
                      coreFieldsEnabled[key]
                        ? "bg-green-600 text-white"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {coreFieldsEnabled[key] ? "On" : "Off"}
                  </button>
                  <span className="capitalize text-sm">
                    {key} ({def.type})
                  </span>
                </div>
              );
            }
          })}
        </div>

        {/* Custom Fields Section */}
        <div className="border p-4 rounded">
          <h4 className="text-md font-semibold mb-2">Custom Fields</h4>
          {customFields.map((field) => (
            <div key={field.id} className="mb-4 border-b pb-2">
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  placeholder="Field Name"
                  value={field.fieldName}
                  onChange={(e) =>
                    updateCustomField(field.id, { fieldName: e.target.value })
                  }
                  className="block border border-gray-600 bg-gray-700 p-2 text-white flex-1 h-10"
                />
                <select
                  value={field.fieldType}
                  onChange={(e) =>
                    updateCustomField(field.id, {
                      fieldType: e.target.value as CustomFieldType,
                      dropdownOptions:
                        e.target.value === "dropdown" ? ["", ""] : undefined,
                    })
                  }
                  className="block border border-gray-600 bg-gray-700 p-2 text-white h-10"
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="dropdown">Dropdown</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeCustomField(field.id)}
                  className="text-red-500 h-10"
                >
                  X
                </button>
              </div>
              {field.fieldType === "dropdown" && (
                <div className="mt-2 ml-4">
                  <h5 className="text-sm font-medium">Dropdown Options</h5>
                  {field.dropdownOptions &&
                    field.dropdownOptions.map((option, idx) => (
                      <div key={idx} className="flex items-center space-x-2 mb-2">
                        <input
                          type="text"
                          placeholder={`Option ${idx + 1}`}
                          value={option}
                          onChange={(e) =>
                            updateDropdownOption(field.id, idx, e.target.value)
                          }
                          className="block border border-gray-600 bg-gray-700 p-2 text-white flex-1 h-10"
                        />
                      </div>
                    ))}
                  <button
                    type="button"
                    onClick={() => addDropdownOption(field.id)}
                    className="text-blue-500 text-sm"
                  >
                    + Add Option
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addCustomField}
            className="text-blue-500 text-sm"
          >
            + Add Custom Field
          </button>
        </div>

        <button
          type="submit"
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Create Type
        </button>
      </form>
    </div>
  );
};

export default LiteratureTypeCreationForm;
