/**
 * ActivityBanner - Next.js Wrapper
 * Wraps the platform-agnostic ActivityBanner with Next.js-specific dependencies
 */

"use client";

import { ActivityBanner as ActivityBannerUI } from "@deeprecall/ui";
import type { ActivityExtended } from "@deeprecall/core";
import { WorkCardCompact } from "./WorkCardCompact";
import { WorkCardList } from "./WorkCardList";

interface ActivityBannerProps {
  activity: ActivityExtended;
  onDropWork: (activityId: string, workId: string) => void;
  onDropBlob: (activityId: string, blobId: string) => void;
  onDropAsset: (activityId: string, assetId: string) => void;
  onDropFiles: (activityId: string, files: FileList) => void;
  onUnlinkWork: (activityId: string, workId: string) => void;
  onUnlinkAsset: (activityId: string, assetId: string) => void;
}

export function ActivityBanner(props: ActivityBannerProps) {
  return (
    <ActivityBannerUI
      {...props}
      WorkCardCompact={WorkCardCompact}
      WorkCardList={WorkCardList}
    />
  );
}
