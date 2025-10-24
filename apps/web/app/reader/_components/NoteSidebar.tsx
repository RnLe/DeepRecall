/**
 * NoteSidebar - Web implementation
 * Thin wrapper providing web-specific operations
 */

"use client";

import {
  NoteSidebar as NoteSidebarBase,
  type NoteSidebarProps,
  type NoteSidebarOperations,
} from "@deeprecall/ui/reader/NoteSidebar";
import { annotations } from "@deeprecall/data";

export interface WebNoteSidebarProps
  extends Omit<NoteSidebarProps, "operations"> {}

export function NoteSidebar(props: WebNoteSidebarProps) {
  const operations: NoteSidebarOperations = {
    // Fetch blob content
    fetchBlobContent: async (sha256: string) => {
      const response = await fetch(`/api/blob/${sha256}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.statusText}`);
      }
      return response.text();
    },

    // Get blob URL for display
    getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,

    // Get annotation assets
    getAnnotationAssets: async (annotationId: string) => {
      return annotations.getAnnotationAssets(annotationId);
    },
  };

  return <NoteSidebarBase {...props} operations={operations} />;
}
