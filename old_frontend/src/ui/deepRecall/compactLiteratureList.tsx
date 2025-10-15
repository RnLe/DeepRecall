import React from "react";
import { LiteratureExtended } from "../../types/deepRecall/strapi/literatureTypes";
import LiteratureCardS from "./literatureCardS";

interface CompactLiteratureListProps {
  items: LiteratureExtended[];
  onSelect: (item: LiteratureExtended) => void;
  className?: string;
}

const CompactLiteratureList: React.FC<CompactLiteratureListProps> = ({
  items,
  onSelect,
  className
}) => {
  return (
    <div className={`grid grid-cols-3 gap-4 ${className || ""}`}>
      {items.map(item => (
        <div
          key={item.documentId}
          className="w-full h-full"
          onClick={() => onSelect(item)}
        >
          <LiteratureCardS literature={item} />
        </div>
      ))}
    </div>
  );
};

export default CompactLiteratureList;