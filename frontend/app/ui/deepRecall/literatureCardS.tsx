import React from "react";
import { LiteratureExtended } from "../../types/deepRecall/strapi/literatureTypes";

interface LiteratureCardSProps {
  literature: LiteratureExtended;
  className?: string;
}

const LiteratureCardS: React.FC<LiteratureCardSProps> = ({ literature, className }) => {
  return (
    <div className={`p-4 border rounded-lg shadow-md bg-gray-800 text-white hover:shadow-lg hover:cursor-pointer hover:bg-slate-600 transition-shadow aspect-square flex flex-col justify-between ${className || ""}`}>
      <h3 className="text-lg font-semibold text-white whitespace-normal break-words">
        {literature.title}
      </h3>
      {literature.subtitle && (
        <p className="text-sm text-gray-400 truncate">{literature.subtitle}</p>
      )}
      <p className="text-xs text-gray-500">Type: {literature.type}</p>
    </div>
  );
};

export default LiteratureCardS;