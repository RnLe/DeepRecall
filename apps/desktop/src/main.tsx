import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initConsoleLogger } from "@deeprecall/data";

// Initialize console logger for debugging (temporary)
initConsoleLogger();
console.log("[Desktop] Console logger initialized");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
