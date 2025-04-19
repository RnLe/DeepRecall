// src/components/pdfViewer/ColorAssignmentPanel.tsx
import React from "react";
import { AnnotationType, annotationTypes } from "../../types/annotationTypes";

interface Props {
  /** Mapping from type → its hex color */
  colorMap: Record<AnnotationType, string>;
  setColorMap: (m: Record<AnnotationType, string>) => void;
  onClose: () => void;
}

const ColorAssignmentPanel: React.FC<Props> = ({
  colorMap,
  setColorMap,
  onClose,
}) => {
  const handleChange = (t: AnnotationType) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setColorMap({
      ...colorMap,
      [t]: e.target.value,
    });
  };

  return (
    <div className="absolute top-16 left-4 z-50 w-64 bg-gray-800 border border-gray-600 p-4 rounded shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-lg font-semibold">Annotation Colors</h4>
        <button onClick={onClose} className="text-white text-xl leading-none">
          ×
        </button>
      </div>
      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className="px-2 text-left">Type</th>
            <th className="px-2">Color</th>
          </tr>
        </thead>
        <tbody>
          {annotationTypes.map((t) => (
            <tr key={t} className="hover:bg-gray-700">
              <td className="px-2 py-1">{t}</td>
              <td className="px-2 py-1">
                <input
                  type="color"
                  value={colorMap[t]}
                  onChange={handleChange(t)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ColorAssignmentPanel;
