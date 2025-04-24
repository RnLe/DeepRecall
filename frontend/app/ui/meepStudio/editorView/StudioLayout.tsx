// src/components/layout/StudioLayout.tsx
"use client";

import React, { useState } from "react";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import TopNavBar from "./TopNavBar";
import TabWindowContainer from "./TabWindowContainer";
import { StudioTabsProvider, useStudioTabs } from "../StudioTabsContext";
import { useMeepProjects } from "@/app/customHooks/useMeepProjects";

const InnerLayout: React.FC = () => {
  const { projects, isLoading, createProject } = useMeepProjects();
  const [rightOpen, setRightOpen] = useState(true);
  const { tabs, activeId, openTab, closeTab, selectTab } = useStudioTabs();
  const active = tabs.find((t) => t.documentId === activeId) || null;

  if (isLoading) return <div className="p-4">Loading …</div>;

  return (
    <div className="flex h-full w-full bg-gray-900 text-white overflow-hidden">
      <LeftSidebar projects={projects} openProject={openTab} createProject={createProject} />

        <div className="flex-1 flex flex-col overflow-hidden">
        <TopNavBar
            tabs={tabs}
            activeId={activeId}
            onSelect={selectTab}
            onClose={closeTab}
            rightOpen={rightOpen}
            onToggleRight={() => setRightOpen((o) => !o)}
        />

        <div className="flex-1 flex overflow-hidden">
            {active ? (
            <TabWindowContainer activeProject={active} />
            ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                Open a project from the explorer
            </div>
            )}

            {/* now underneath the top bar, as a sibling of the main pane */}
            <RightSidebar open={rightOpen} project={active} />
        </div>
        </div>

    </div>
  );
};

const StudioLayout = () => (
  <StudioTabsProvider>
    <InnerLayout />
  </StudioTabsProvider>
);

export default StudioLayout;