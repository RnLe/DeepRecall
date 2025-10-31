"use client";

import { TelemetryLogViewer } from "@deeprecall/ui/admin/TelemetryLogViewer";
import { getRingBuffer } from "@/src/telemetry";

export default function LogsPage() {
  // Component handles getRingBuffer internally
  return <TelemetryLogViewer getRingBuffer={getRingBuffer} />;
}
