/**
 * NoteSidebar - Mobile implementation
 * Thin wrapper providing mobile-specific operations
 */

import {
  NoteSidebar as NoteSidebarBase,
  type NoteSidebarProps,
  type NoteSidebarOperations,
} from "@deeprecall/ui";
import { annotations } from "@deeprecall/data";
import {
  useCapacitorBlobStorage,
  fetchBlobContent,
} from "../../../blob-storage/capacitor";

export type MobileNoteSidebarProps = Omit<NoteSidebarProps, "operations">;

export function NoteSidebar(props: MobileNoteSidebarProps) {
  const cas = useCapacitorBlobStorage();

  const operations: NoteSidebarOperations = {
    // Fetch blob content
    fetchBlobContent: async (sha256: string) => {
      return await fetchBlobContent(sha256);
    },

    // Get blob URL for display
    getBlobUrl: (sha256: string) => cas.getUrl(sha256),

    // Get annotation assets
    getAnnotationAssets: async (annotationId: string) => {
      return annotations.getAnnotationAssets(annotationId);
    },
  };

  return <NoteSidebarBase {...props} operations={operations} />;
}
