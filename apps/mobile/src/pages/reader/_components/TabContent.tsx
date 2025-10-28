/**
 * TabContent - Mobile wrapper for platform-agnostic TabContent
 * Injects PDFViewer component and blob URL generator
 */

import { TabContent as TabContentUI } from "@deeprecall/ui";
import { PDFViewer } from "../PDFViewer";
import { useCapacitorBlobStorage } from "../../../blob-storage/capacitor";

export function TabContent() {
  const cas = useCapacitorBlobStorage();

  return (
    <TabContentUI
      PDFViewerComponent={PDFViewer}
      getBlobUrl={(sha256) => cas.getUrl(sha256)}
    />
  );
}
