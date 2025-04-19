import React from "react";
import { X } from "lucide-react";
import { LiteratureExtended } from "../../../types/literatureTypes";

interface Props {
  tabs: LiteratureExtended[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

const TopNavBar: React.FC<Props> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
}) => (
  <div className="flex items-center h-10 bg-gray-800 border-b border-gray-700 px-2">
    <div className="flex space-x-1 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.documentId}
          className={`flex items-center space-x-1 px-3 py-1 rounded-t cursor-pointer ${
            tab.documentId === activeTabId
              ? "bg-gray-900"
              : "bg-gray-800 hover:bg-gray-700"
          }`}
          onClick={() => onSelectTab(tab.documentId!)}
        >
          <span className="truncate max-w-xs">{tab.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab.documentId!);
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  </div>
);

export default TopNavBar;
