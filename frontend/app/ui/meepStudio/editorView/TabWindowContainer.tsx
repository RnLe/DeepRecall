import React from "react";
import ProjectCanvas from "../canvas/ProjectCanvas";
import { MeepProject } from "@/app/types/meepStudio/meepProjectTypes";

const TabWindowContainer: React.FC<{ activeProject: MeepProject }> = ({ activeProject }) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Any per-tab local state / toolbars can live here */}
      <ProjectCanvas project={activeProject} />
    </div>
  );
};
export default TabWindowContainer;
