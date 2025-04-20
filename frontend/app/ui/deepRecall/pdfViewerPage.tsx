"use client";

import React, { useState, useEffect } from "react";
import { useLiterature, useLiteratureTypes } from "../../customHooks/useLiterature";
import { useAnnotationGroups } from "@/app/customHooks/useAnnotationGroups";
import { useAnnotationTags } from "@/app/customHooks/useAnnotationTags";
import { LiteratureExtended } from "../../types/literatureTypes";
import { AnnotationType, annotationTypes } from "../../types/annotationTypes";
import { AnnotationMode } from "./annotationToolbar";
import { useColors } from "../../customHooks/useColors";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

import TopNavBar from "./layout/TopNavBar";
import LeftSidebar from "./layout/LeftSidebar";
import TabManager from "./layout/TabManager";

const PdfViewerPage: React.FC<{ className?: string }> = ({ className }) => {
  // --- fetch literature & types ---
  const { data: items = [], isLoading: litLoading, error: litError } = useLiterature();
  const { data: types = [], isLoading: typesLoading, error: typesError } = useLiteratureTypes();

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

  // --- sidebar toggle state (for TopNavBar & PdfAnnotationContainer) ---
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeTabs, setActiveTabs] = useState<LiteratureExtended[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const toggleSidebar = () => { setSidebarOpen(o => !o); };

  const openTab = (lit: LiteratureExtended) => {
    setActiveTabs((prev) =>
      prev.find((t) => t.documentId === lit.documentId) ? prev : [...prev, lit]
    );
    setActiveTabId(lit.documentId!);
  };
  const closeTab = (id: string) => {
    setActiveTabs((prev) => prev.filter((t) => t.documentId !== id));
    if (activeTabId === id) {
      // switch to next or previous
      const idx = activeTabs.findIndex((t) => t.documentId === id);
      const next = activeTabs[idx + 1] || activeTabs[idx - 1];
      setActiveTabId(next?.documentId || null);
    }
  };

  // --- per‐tab annotation mode (lifted state) ---
  const [modeMap, setModeMap] = useState<Record<string, AnnotationMode>>({});
  const currentMode = activeTabId ? modeMap[activeTabId] || "none" : "none";
  const setCurrentMode = (m: AnnotationMode) => {
    if (!activeTabId) return;
    setModeMap((prev) => ({
      ...prev,
      [activeTabId]:
        prev[activeTabId] === m ? "none" : m,
    }));
  };

  // --- loading / error states ---
  if (litLoading || typesLoading || schemesLoading) return <div>Loading…</div>;
  if (litError || typesError) return <div>Error loading literature</div>;
  if (schemesError) return <div>Error loading color schemes</div>;

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
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNavBar
          tabs={activeTabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={closeTab}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
        />

        <TabManager
          tabs={activeTabs}
          activeTabId={activeTabId}
          annotationMode={currentMode}
          setAnnotationMode={setCurrentMode}      // <-- forward setter
          colorMap={colorMap}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
        />
      </div>
    </div>
  );
};

export default PdfViewerPage;
