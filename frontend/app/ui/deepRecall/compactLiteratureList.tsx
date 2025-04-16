import React, { useState } from "react";
import { LiteratureItem } from "../../types/literatureTypesLegacy";
import LiteratureCardS from "./literatureCardS";

interface CompactLiteratureListProps {
  items: LiteratureItem[];
  onSelect: (item: LiteratureItem) => void;
  classNames?: string; // new prop
}

const CompactLiteratureList: React.FC<CompactLiteratureListProps> = ({ items, onSelect, classNames }) => {
  return (
    <div className={`grid grid-cols-3 gap-4 ${classNames || ""}`}>
      {items.map((item) => (
        <div key={item.documentId} className="w-full h-full" onClick={() => onSelect(item)}>
          <LiteratureCardS item={item} />
        </div>
      ))}
    </div>
  );
};

export default CompactLiteratureList;