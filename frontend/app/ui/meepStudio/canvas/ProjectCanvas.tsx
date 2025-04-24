import React from "react";
import { MeepProject } from "@/app/types/meepStudio/meepProjectTypes";

/** Simple placeholder – later swap for konva / three.js canvas */
const ProjectCanvas: React.FC<{ project: MeepProject }> = ({ project }) => (
  <div className="flex-1 flex items-center justify-center text-gray-400">
    <div className="border border-dashed border-gray-600 p-4 rounded w-3/4 h-3/4">
      <p className="text-lg mb-2">{project.title}</p>
      <p className="text-sm">Canvas placeholder – geometry will appear here</p>
    </div>
  </div>
);

export default ProjectCanvas;
