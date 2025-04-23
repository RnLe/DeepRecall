// src/components/pdfViewer/layout/TopNavBar.tsx
import React from "react";
import { X, PanelRightOpen, PanelRightClose } from "lucide-react";
import { LiteratureExtended } from "../../../types/deepRecall/strapi/literatureTypes";

interface Props {
  tabs: LiteratureExtended[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const TopNavBar: React.FC<Props> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  sidebarOpen,
  onToggleSidebar,
}) => (
  <div className="flex items-center h-10 bg-gray-800 border-b border-gray-700 px-2">
    {/* Tabs */}
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
            <X size={12} className="text-gray-400 hover:text-white" />
          </button>
        </div>
      ))}
    </div>

    {/* Right‑side controls (slide left with sidebar width) */}
    <div
      className="ml-auto flex items-center space-x-2 pr-2"
      style={{
        marginRight: sidebarOpen ? "20rem" : 0,          // width of the sidebar (w‑80)
        transition: "margin-right 0.2s ease",            // smooth glide
      }}
    >
      <button
        onClick={onToggleSidebar}
        className="p-1 text-gray-400 hover:text-white transition-colors"
      >
        {sidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
      </button>
      {/* reserve space for future icons */}
    </div>
  </div>
);

export default TopNavBar;
