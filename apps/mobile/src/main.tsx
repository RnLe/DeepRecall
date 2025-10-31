import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import App from "./App.tsx";
import { initTelemetry } from "./telemetry";
import { logger } from "@deeprecall/telemetry";

// Initialize structured telemetry (console + ring buffer in dev)
initTelemetry();
logger.info("ui", "Mobile app initialized");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
