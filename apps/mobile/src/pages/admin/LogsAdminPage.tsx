/**
 * Telemetry Logs Admin Page for Mobile
 * Shows logs from the ring buffer
 */

import { TelemetryLogViewer } from "@deeprecall/ui";
import { getRingBuffer } from "../../telemetry";

export default function LogsAdminPage() {
  return (
    <div className="h-full overflow-hidden bg-gray-950">
      <TelemetryLogViewer getRingBuffer={getRingBuffer} />
    </div>
  );
}
