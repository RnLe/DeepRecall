import React from "react";
import { X, Layout } from "lucide-react";
import { MeepProject } from "@/app/types/meepStudio/strapi/meepProjectTypes";

interface Props {
  tabs: MeepProject[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  rightOpen: boolean;
  onToggleRight: () => void;
}

const TopNavBar: React.FC<Props> = ({
  tabs,
  activeId,
  onSelect,
  onClose,
  rightOpen,
  onToggleRight,
}) => (
  <div className="flex items-center h-10 bg-gray-800 border-b border-gray-700 px-2">
    {/* ─────────────── tabs ─────────────── */}
    <div className="flex space-x-1 overflow-x-auto">
      {tabs.map((t) => (
        <div
          key={t.documentId}
          onClick={() => onSelect(t.documentId!)}
          className={`flex items-center px-3 py-1 rounded-t cursor-pointer ${
            t.documentId === activeId ? "bg-gray-900" : "bg-gray-800 hover:bg-gray-700"
          }`}
        >
          <span className="truncate max-w-xs">{t.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose(t.documentId!);
            }}
          >
            <X size={12} className="ml-1 text-gray-400 hover:text-white" />
          </button>
        </div>
      ))}
    </div>

    {/* ─────────────── right-sidebar toggle ─────────────── */}
    <button
      onClick={onToggleRight}
      className="ml-auto p-1 hover:bg-gray-700 rounded"
      title="Toggle simulation sidebar"
    >
      <Layout size={18} className={rightOpen ? "text-white" : "text-gray-400"} />
    </button>
  </div>
);

export default TopNavBar;
