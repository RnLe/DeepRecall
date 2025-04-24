// src/components/layout/TabWindowContainer.tsx
"use client";
import React from "react";
import dynamic from "next/dynamic";
import CanvasToolbar from "./CanvasToolbar";
import { MeepProject } from "@/app/types/meepStudio/strapi/meepProjectTypes";

// dynamically load the client-only ProjectCanvas with typed props
const ProjectCanvas = dynamic<{ project: MeepProject }>(
  () => import("../canvas/ProjectCanvas"),
  { ssr: false }
);

const TabWindowContainer: React.FC<{ activeProject: MeepProject }> = ({
  activeProject,
}) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* toolbar can sit above the canvas */}
      <CanvasToolbar />

      {/* this import only runs in the browser */}
      <ProjectCanvas project={activeProject} />
    </div>
  );
};

export default TabWindowContainer;
