import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initTelemetry } from "./telemetry";
import { logger } from "@deeprecall/telemetry";

// Initialize structured telemetry (console + ring buffer in dev)
initTelemetry();
logger.info("ui", "Desktop app initialized");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
