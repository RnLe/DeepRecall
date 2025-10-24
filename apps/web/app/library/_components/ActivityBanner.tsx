/**
 * ActivityBanner - Next.js Wrapper
 * Thin wrapper providing platform-specific file drop handling
 */

"use client";

import {
  ActivityBanner as ActivityBannerUI,
  type ActivityBannerOperations,
} from "@deeprecall/ui";
import type { Activity, Work, Asset } from "@deeprecall/core";

interface ActivityExtended extends Activity {
  works?: Work[];
  assets?: Asset[];
}

interface ActivityBannerProps {
  activity: ActivityExtended;
  onDropFiles: (activityId: string, files: FileList) => void;
}

export function ActivityBanner({ activity, onDropFiles }: ActivityBannerProps) {
  const operations: ActivityBannerOperations = {
    onDropFiles,
  };

  return <ActivityBannerUI activity={activity} operations={operations} />;
}
