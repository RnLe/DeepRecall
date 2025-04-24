"use client";

import React, { useState } from "react";
import { Folder, Wrench } from "lucide-react";
import { MeepProject } from "@/app/types/meepStudio/strapi/meepProjectTypes";
import ProjectExplorer from "./ProjectExplorer";

type Panel = "explorer" | "toolbar" | null;

interface Props {
  projects: MeepProject[];
  openProject: (p: MeepProject) => void;
  createProject: (p: MeepProject) => Promise<MeepProject>;
}

export default function LeftSidebar({ projects, openProject, createProject }: Props) {
  const [panel, setPanel] = useState<Panel>("explorer");

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  const icons = [
    { key: "explorer", Icon: Folder, title: "Explorer" },
    { key: "toolbar", Icon: Wrench, title: "Toolbar" },
  ] as const;

  return (
    <div className="flex h-full">
      {/* Icon column */}
      <div className="flex flex-col w-14 bg-gray-800 border-r border-gray-700 space-y-2">
        {icons.map(({ key, Icon, title }) => {
          const isActive = panel === key;
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              title={title}
              className={`group relative flex items-center justify-center w-full h-12 box-border ${
                isActive ? "border-l-4 border-blue-400" : "border-l-4 border-transparent"
              }`}
            >
              <Icon
                size={25}
                className={`transition-colors ${
                  isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Sliding panel */}
      <div
        className={`flex-none bg-gray-900 border-r border-gray-700 overflow-hidden transition-all duration-200 ${
          panel ? "w-64" : "w-0"
        }`}
      >
        <div className="h-full flex flex-col">
          {panel === "explorer" && (
            <ProjectExplorer
              projects={projects}
              openProject={openProject}
              createProject={createProject}
            />
          )}

          {panel === "toolbar" && (
            <div className="p-4 text-sm text-gray-400">
              <p className="mb-2 font-semibold text-white">Toolbar (stub)</p>
              <p>Add geometry primitives, sources, …</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
