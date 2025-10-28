/**
 * SimplePDFViewer - Mobile wrapper for platform-agnostic SimplePDFViewer
 * Injects blob URL generator using Capacitor storage
 */

import {
  SimplePDFViewer as SimplePDFViewerUI,
  type SimplePDFViewerProps as BaseProps,
} from "@deeprecall/ui/components";
import { useCapacitorBlobStorage } from "../../../blob-storage/capacitor";

/** Mobile-specific props (getBlobUrl auto-injected) */
export type SimplePDFViewerProps = Omit<BaseProps, "getBlobUrl">;

/**
 * Mobile-specific SimplePDFViewer with blob URL helper
 */
export function SimplePDFViewer(props: SimplePDFViewerProps) {
  const cas = useCapacitorBlobStorage();
  const getBlobUrl = (sha256: string) => cas.getUrl(sha256);

  return <SimplePDFViewerUI {...props} getBlobUrl={getBlobUrl} />;
}
