import { TelemetryLogViewer } from "@deeprecall/ui";
import { getRingBuffer } from "../../telemetry";

export default function LogsPage() {
  return (
    <div className="h-full bg-gray-950">
      <TelemetryLogViewer getRingBuffer={getRingBuffer} />
    </div>
  );
}
