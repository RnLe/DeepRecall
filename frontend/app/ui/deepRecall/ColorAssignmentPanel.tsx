// src/components/pdfViewer/ColorAssignmentPanel.tsx
import React from "react";
import { AnnotationKind } from "../../types/annotationTypes";

interface ColorPair {
  color: string;
  selectedColor: string;
}

interface Props {
  colorMap: Record<AnnotationKind, ColorPair>;
  setColorMap: (m: Record<AnnotationKind, ColorPair>) => void;
  onClose: () => void;
}

const kinds: AnnotationKind[] = [
  "Equation","Plot","Illustration","Theorem","Statement",
  "Definition","Figure","Table","Exercise","Problem",
];

const ColorAssignmentPanel: React.FC<Props> = ({
  colorMap,
  setColorMap,
  onClose,
}) => {
  const handleChange =
    (kind: AnnotationKind, field: "color" | "selectedColor") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setColorMap({
        ...colorMap,
        [kind]: { ...colorMap[kind], [field]: e.target.value },
      });
    };

  return (
    <div className="absolute top-16 left-4 z-50 w-80 bg-gray-800 border border-gray-600 p-4 rounded shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-lg font-semibold">Color Mapping</h4>
        <button onClick={onClose} className="text-white text-xl leading-none">
          ×
        </button>
      </div>
      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className="px-2 text-left">Type</th>
            <th className="px-2">Color</th>
            <th className="px-2">Selected</th>
          </tr>
        </thead>
        <tbody>
          {kinds.map((k) => (
            <tr key={k} className="hover:bg-gray-700">
              <td className="px-2 py-1">{k}</td>
              <td className="px-2 py-1">
                <input
                  type="color"
                  value={colorMap[k].color}
                  onChange={handleChange(k, "color")}
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="color"
                  value={colorMap[k].selectedColor}
                  onChange={handleChange(k, "selectedColor")}
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
