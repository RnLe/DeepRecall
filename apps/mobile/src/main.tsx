import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import App from "./App.tsx";
import { initConsoleLogger } from "@deeprecall/data";

// Initialize console logger for mobile debugging
// NOTE: This is temporary - remove when proper telemetry is implemented
initConsoleLogger();
console.log("[Mobile] Console logger initialized");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
