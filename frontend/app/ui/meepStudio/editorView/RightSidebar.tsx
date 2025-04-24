// src/components/layout/RightSidebar.tsx
import React from "react";
import SimulationConsole from "../SimulationConsole";
import { MeepProject } from "@/app/types/meepStudio/meepProjectTypes";

interface Props {
  open: boolean;
  project: MeepProject | null;
}

const RightSidebar: React.FC<Props> = ({ open, project }) => {
  return (
    <div
      className={`flex-shrink-0 w-80 bg-gray-900 border-l border-gray-700 p-4 space-y-4
        transform transition-transform duration-200
        ${open ? "translate-x-0" : "translate-x-full"}`}
    >
      {project ? (
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">{project.title}</h2>
          {project.description && (
            <p className="text-sm text-gray-400">{project.description}</p>
          )}
        </div>
      ) : (
        <p className="text-gray-500">No project selected</p>
      )}

      <hr className="border-gray-700" />

      <h3 className="text-lg font-semibold text-white">Simulation</h3>
      <button className="w-full py-1 bg-blue-600 rounded">Run ▶︎</button>
      <button className="w-full py-1 bg-red-600 rounded">Stop ■</button>
      <div className="border border-gray-600 rounded h-40 overflow-hidden">
        <SimulationConsole logs={project?.lastExecutionConsoleLogs || []} />
      </div>
      <div className="border border-gray-600 rounded h-40 flex items-center justify-center text-gray-500 text-sm">
        Field plot
      </div>
    </div>
  );
};

export default RightSidebar;
