// annotationList.tsx

import React from "react";
import { Check } from "lucide-react";
import { Annotation } from "../../types/annotationTypes";

interface Props {
  annotations: Annotation[];
  selectedId: string | null;
  hoveredId: string | null;
  multi: boolean;
  multiSet: Set<string>;
  /** Click in single‑select mode */
  onItemClick: (annotation: Annotation) => void;
  /** Toggle in multi‑select mode */
  onToggleMulti: (annotation: Annotation) => void;
  /** Hover enter/leave */
  onHover: (id: string | null) => void;
}

const AnnotationList: React.FC<Props> = ({
  annotations,
  selectedId,
  hoveredId,
  multi,
  multiSet,
  onItemClick,
  onToggleMulti,
  onHover,
}) => (
  <ul className="flex-1 overflow-y-auto divide-y divide-gray-800">
    {annotations.map((a) => {
      const isChecked = multi && multiSet.has(a.documentId!);
      const isActive = selectedId === a.documentId;
      const isHovered = hoveredId === a.documentId;

      const handleClick = () => {
        if (multi) onToggleMulti(a);
        else onItemClick(a);
      };

      return (
        <li
          key={a.documentId}
          className={`px-3 py-1 flex items-center space-x-2 cursor-pointer ${
            isActive ? "bg-gray-700" : isHovered ? "bg-gray-600" : ""
          }`}
          onClick={handleClick}
          onMouseEnter={() => onHover(a.documentId!)}
          onMouseLeave={() => onHover(null)}
        >
          {multi && (
            isChecked ? (
              <Check size={16} />
            ) : (
              <span className="text-gray-600">○</span>
            )
          )}
          <span className="flex-1 truncate">
            {a.type === "rectangle" ? a.annotationKind : "Highlight"} – p.
            {a.page}
          </span>
        </li>
      );
    })}
  </ul>
);

export default AnnotationList;