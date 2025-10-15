import React from "react";
import { LiteratureExtended, isLiteratureRead, isLiteratureFavorite } from "../../types/deepRecall/strapi/literatureTypes";
import { Glasses, Star } from 'lucide-react';

interface LiteratureCardSProps {
  literature: LiteratureExtended;
  className?: string;
}

const LiteratureCardS: React.FC<LiteratureCardSProps> = ({ literature, className }) => {
  return (
    <div className={`relative p-4 border rounded-lg shadow-md bg-gray-800 text-white hover:shadow-lg hover:cursor-pointer hover:bg-slate-600 transition-shadow aspect-square flex flex-col justify-between ${className || ""}`}>
      {/* Status icons - positioned on top right */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {isLiteratureRead(literature) && (
          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
            <Glasses className="w-2 h-2 text-white" />
          </div>
        )}
        {isLiteratureFavorite(literature) && (
          <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center shadow-sm">
            <Star className="w-2 h-2 text-white fill-current" />
          </div>
        )}
      </div>
      
      <h3 className="text-lg font-semibold text-white whitespace-normal break-words pr-8">
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