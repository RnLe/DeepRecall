import React from "react";
import { LiteratureItem } from "../../helpers/literatureTypesLegacy";

interface LiteratureCardSProps {
  item: LiteratureItem;
  classNames?: string; // new prop
}

const LiteratureCardS: React.FC<LiteratureCardSProps> = ({ item, classNames }) => {
  return (
    <div className={`p-4 border rounded-lg shadow-md bg-gray-800 text-white hover:shadow-lg hover:cursor-pointer hover:bg-slate-600 transition-shadow aspect-square flex flex-col justify-between ${classNames || ""}`}>
      <h3 className="text-lg font-semibold truncate">{item.title}</h3>
      {item.subtitle && <p className="text-sm text-gray-400 truncate">{item.subtitle}</p>}
      <p className="text-xs text-gray-500">Type: {item.type}</p>
    </div>
  );
};

export default LiteratureCardS;