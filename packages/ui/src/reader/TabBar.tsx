/**
 * TabBar - VSCode-style tab manager
 * Displays open tabs with close buttons, allows switching between tabs
 *
 * Platform-agnostic component using @deeprecall/data stores
 */

"use client";

import { useReaderUI, type Tab } from "@deeprecall/data";
import { X, FileText } from "lucide-react";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useReaderUI();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center bg-gray-800 border-b border-gray-700 overflow-x-auto">
      {tabs.map((tab: Tab) => {
        const isActive = tab.id === activeTabId;

        return (
          <div
            key={tab.id}
            className={`
              group flex items-center gap-2 px-4 py-2 border-r border-gray-700 cursor-pointer
              transition-colors min-w-0 max-w-xs
              ${
                isActive
                  ? "bg-gray-900 border-b-2 border-b-purple-500 text-gray-100"
                  : "bg-gray-800 hover:bg-gray-750 text-gray-400"
              }
            `}
            onClick={() => setActiveTab(tab.id)}
          >
            {/* Icon */}
            <FileText
              className={`w-4 h-4 shrink-0 ${isActive ? "text-purple-400" : ""}`}
            />

            {/* Title */}
            <span className="text-sm truncate flex-1">
              {tab.title}
              {tab.isDirty && <span className="ml-1">•</span>}
            </span>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={`
                p-0.5 rounded hover:bg-gray-700 transition-colors shrink-0 text-gray-400 hover:text-gray-200
                ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
              `}
              aria-label="Close tab"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
