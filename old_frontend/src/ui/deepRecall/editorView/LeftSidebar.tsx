import React, { useState } from "react";
import { Folder, PenToolIcon, Palette, BrainCog  } from "lucide-react";
import { LiteratureExtended, LiteratureType } from "../../../types/deepRecall/strapi/literatureTypes";
import AnnotationToolbar, { AnnotationMode } from "../annotationToolbar";
import SidebarColorAssignmentPanel from "./SidebarColorAssignmentPanel";
import AiTasksPanel from "./AiTasksPanel";
import { AiTasks } from "@/src/api/openAI/promptTypes";

interface Props {
  literature: LiteratureExtended[];
  types: LiteratureType[];
  openTab: (lit: LiteratureExtended) => void;
  schemes: any[];
  selectedSchemeId: string;
  setSelectedSchemeId: (id: string) => void;
  colorMap: Record<string, string>;
  setColorMap: (map: Record<string, string>) => void;
  createScheme: any;
  updateScheme: any;
  deleteScheme: any;

  currentMode: AnnotationMode;
  setCurrentMode: (mode: AnnotationMode) => void;
  taskModelMap: Record<string, string>;
  setTaskModelMap: (map: Record<string, string>) => void;
}

const LeftSidebar: React.FC<Props> = ({
  literature,
  openTab,
  schemes,
  selectedSchemeId,
  setSelectedSchemeId,
  colorMap,
  setColorMap,
  createScheme,
  updateScheme,
  deleteScheme,
  currentMode,
  setCurrentMode,
  taskModelMap,
  setTaskModelMap,
}) => {
  const [panel, setPanel] = useState<"explorer" | "tools" | "colors" | "ai" | null>(
    "explorer"
  );
  const toggle = (p: typeof panel) => setPanel(panel === p ? null : p);

  const groups = literature.reduce<Record<string, LiteratureExtended[]>>(
    (acc, lit) => {
      const key = lit.type || "Unknown";
      (acc[key] = acc[key] || []).push(lit);
      return acc;
    },
    {}
  );

  return (
    <div className="flex h-full">
      {/* Icon column */}
      <div className="flex flex-col w-14 bg-gray-800 border-r border-gray-700 space-y-2">
        {[
          { key: "explorer", Icon: Folder },
          { key: "tools", Icon: PenToolIcon },
          { key: "colors", Icon: Palette },
          { key: "ai", Icon: BrainCog  },
        ].map(({ key, Icon }) => {
          const isActive = panel === key;
          return (
            <button
              key={key}
              onClick={() => toggle(key as any)}
              className={`group relative flex items-center justify-center w-full h-12 box-border ${
                isActive
                  ? "border-l-4 border-blue-400"
                  : "border-l-4 border-transparent"
              }`}
            >
              <Icon
                size={25}
                className={`transition-colors ${
                  isActive
                    ? "text-white"
                    : "text-gray-400 group-hover:text-white"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Sliding panel */}
      <div
        className={`flex-none bg-gray-900 border-r border-gray-700 overflow-hidden transition-all duration-200 ${
          panel ? "w-72" : "w-0"
        }`}
      >
        <div className="h-full flex flex-col">
          {panel === "explorer" && (
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
              {Object.entries(groups).map(([type, items]) => (
                <div key={type}>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-400">
                    {type}
                  </div>
                  {items.map((lit) => (
                    <div
                      key={lit.documentId}
                      className="px-3 py-1 text-sm hover:text-white transition-colors cursor-pointer truncate"
                      onClick={() => openTab(lit)}
                    >
                      {lit.title}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {panel === "tools" && (
            <AnnotationToolbar
                mode={currentMode}
                setMode={setCurrentMode}
            />
          )}

          {panel === "colors" && (
            <SidebarColorAssignmentPanel
              colorMap={colorMap}
              setColorMap={setColorMap}
              schemes={schemes}
              selectedSchemeId={selectedSchemeId}
              onSchemeSelect={setSelectedSchemeId}
              createScheme={createScheme}
              updateScheme={updateScheme}
              deleteScheme={deleteScheme}
            />
          )}

          {panel === "ai" && (
            <AiTasksPanel
              taskModelMap={taskModelMap}
              setTaskModelMap={setTaskModelMap}
            />
          )}
        </div>
      </div>
    </div>
)};

export default LeftSidebar;
