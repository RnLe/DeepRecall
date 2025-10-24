"use client";

// ========================================
// PURE UI IMPORTS (from @deeprecall/ui)
// ========================================
import {
  DexieGraphVisualization as DexieGraphVisualizationUI,
  type DexieGraphVisualizationOperations,
} from "@deeprecall/ui";

// ========================================
// PLATFORM HOOKS (from @/src/hooks)
// ========================================
import { useWorksExtended } from "@/src/hooks/useLibrary";
import { useRouter } from "next/navigation";
import { useReaderUI } from "@deeprecall/data";

export function DexieGraphVisualization() {
  const works = useWorksExtended();
  const router = useRouter();
  const { openTab, setLeftSidebarView } = useReaderUI();

  const operations: DexieGraphVisualizationOperations = {
    navigateToReader: (sha256: string, title: string) => {
      openTab(sha256, title, "pdf-viewer");
      setLeftSidebarView("annotations");
      router.push("/reader");
    },
    getWorkCardOperations: () => ({
      navigate: (path: string) => router.push(path),
      getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,
    }),
  };

  return <DexieGraphVisualizationUI works={works} operations={operations} />;
}
