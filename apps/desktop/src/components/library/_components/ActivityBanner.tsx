/**
 * ActivityBanner - Tauri Wrapper
 * Thin wrapper providing platform-specific file drop handling
 */

import {
  ActivityBanner as ActivityBannerUI,
  type ActivityBannerOperations,
} from "@deeprecall/ui";
import type { Activity, Work, Asset } from "@deeprecall/core";
import { useTauriBlobStorage } from "@/hooks/useBlobStorage";

interface ActivityExtended extends Activity {
  works?: Work[];
  assets?: Asset[];
}

interface ActivityBannerProps {
  activity: ActivityExtended;
  onDropFiles: (activityId: string, files: FileList) => void;
}

export function ActivityBanner({ activity, onDropFiles }: ActivityBannerProps) {
  const cas = useTauriBlobStorage();

  const operations: ActivityBannerOperations = {
    onDropFiles,
    cas,
  };

  return <ActivityBannerUI activity={activity} operations={operations} />;
}
