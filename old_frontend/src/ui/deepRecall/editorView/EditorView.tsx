"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useLiterature, useLiteratureTypes } from "../../../customHooks/useLiterature";
import { LiteratureExtended } from "../../../types/deepRecall/strapi/literatureTypes";
import { AnnotationType, annotationTypes } from "../../../types/deepRecall/strapi/annotationTypes";
import { AnnotationMode } from "../annotationToolbar";
import { useColors } from "../../../customHooks/useColors";
import { useAppStateStore } from "../../../stores/appStateStore";

import TopNavBar from "./TopNavBar";
import LeftSidebar from "./LeftSidebar";
import TabManager from "./TabManager";
import { AiTasks } from "@/src/api/openAI/promptTypes";

interface EditorViewProps {
  className?: string;
}

const EditorView: React.FC<EditorViewProps> = ({ 
  className,
}) => {
  // --- fetch literature & types ---
  const { data: items = [], isLoading: litLoading, error: litError } = useLiterature();
  const { data: types = [], isLoading: typesLoading, error: typesError } = useLiteratureTypes();

  // --- App state store ---
  const {
    tabs,
    activeTabId,
    sidebarOpen,
    navigationQueue,
    openTab,
    closeTab,
    setActiveTab,
    toggleSidebar,
    processNavigationQueue,
  } = useAppStateStore();

  const [taskModelMap, setTaskModelMap] = useState(() => {
    const init: Record<string, string> = {};
    Object.entries(AiTasks).forEach(([k, v]) => (init[k] = v.defaultModel));
    return init;
  });

  // --- color schemes (for sidebar) ---
  const {
    schemes,
    isLoading: schemesLoading,
    error: schemesError,
    createScheme,
    updateScheme,
    deleteScheme,
  } = useColors();

  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("");
  const [colorMap, setColorMap] = useState<Record<AnnotationType,string>>(
    annotationTypes.reduce(
      (acc, t) => ({ ...acc, [t]: "#000000" }),
      {} as Record<AnnotationType,string>
    )
  );

  // initialize selectedScheme
  useEffect(() => {
    if (schemes.length && !selectedSchemeId) {
      setSelectedSchemeId(schemes[0].documentId!);
    }
  }, [schemes, selectedSchemeId]);

  // load colors from selected scheme
  useEffect(() => {
    const scheme = schemes.find((s) => s.documentId === selectedSchemeId);
    if (!scheme) return;
    setColorMap({
      ...annotationTypes.reduce(
        (acc, t) => ({ ...acc, [t]: "#000000" }),
        {} as Record<AnnotationType,string>
      ),
      ...scheme.scheme.annotationColors,
    });
  }, [selectedSchemeId, schemes]);

  // Process navigation queue when literature data becomes available
  useEffect(() => {
    if (!litLoading && items.length > 0 && navigationQueue.length > 0) {
      console.log('EditorView: Processing navigation queue with', items.length, 'literatures');
      processNavigationQueue(items);
    }
  }, [litLoading, items.length, navigationQueue.length, processNavigationQueue, items]);

  // Handle active tab changes to ensure position tracking
  useEffect(() => {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (activeTab) {
      console.log('EditorView: Active tab changed to:', activeTab.title);
    }
  }, [activeTabId, tabs]);

  // Convert tabs from store to LiteratureExtended[] for compatibility
  const activeTabs = tabs.map(tab => tab.literature);

  // Get the active tab for file hash and other properties
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // Handle tab closing with store
  const handleCloseTab = useCallback((literatureId: string) => {
    const tab = tabs.find(t => t.literatureId === literatureId);
    if (tab) {
      closeTab(tab.id);
    }
  }, [tabs, closeTab]);

  // Handle tab selection with store
  const handleSelectTab = useCallback((literatureId: string) => {
    const tab = tabs.find(t => t.literatureId === literatureId);
    if (tab) {
      setActiveTab(tab.id);
    }
  }, [tabs, setActiveTab]);

  // Get current active literature ID for TopNavBar compatibility
  const activeLiteratureId = activeTab?.literatureId || null;

  // --- per‐tab annotation mode (lifted state) ---
  const [modeMap, setModeMap] = useState<Record<string, AnnotationMode>>({});
  const currentMode = activeLiteratureId ? modeMap[activeLiteratureId] || "none" : "none";
  const setCurrentMode = (m: AnnotationMode) => {
    if (!activeLiteratureId) return;
    setModeMap((prev) => ({
      ...prev,
      [activeLiteratureId]:
        prev[activeLiteratureId] === m ? "none" : m,
    }));
  };

  // --- loading / error states ---
  if (litLoading || typesLoading || schemesLoading) return <div>Loading…</div>;
  if (litError || typesError) return <div>Error loading literature</div>;
  if (schemesError) return <div>Error loading color schemes</div>;

  // Get the file hash for the active tab if it exists
  const initialFileHash = activeTab?.fileHash || null;

  return (
    <div className={`flex h-full w-full bg-gray-900 text-white ${className || ""}`}>
      <LeftSidebar
        literature={items}
        types={types}
        openTab={openTab}
        schemes={schemes}
        selectedSchemeId={selectedSchemeId}
        setSelectedSchemeId={setSelectedSchemeId}
        colorMap={colorMap}
        setColorMap={setColorMap}
        createScheme={createScheme}
        updateScheme={updateScheme}
        deleteScheme={deleteScheme}
        currentMode={currentMode}
        setCurrentMode={setCurrentMode}
        taskModelMap={taskModelMap}
        setTaskModelMap={setTaskModelMap}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNavBar
          tabs={activeTabs}
          activeTabId={activeLiteratureId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
        />

        <TabManager
          tabs={activeTabs}
          activeTabId={activeLiteratureId}
          annotationMode={currentMode}
          setAnnotationMode={setCurrentMode}
          colorMap={colorMap}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          taskModelMap={taskModelMap}
          initialFileHash={initialFileHash}
        />
      </div>
    </div>
  );
};

export default EditorView;
