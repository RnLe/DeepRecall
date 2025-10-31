import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "@deeprecall/telemetry";

/**
 * DevTools keyboard shortcut component
 * Enables F12 to open/close DevTools in Windows builds
 */
export function DevToolsShortcut() {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // F12 to toggle DevTools
      if (e.key === "F12") {
        e.preventDefault();
        try {
          const isOpen = await invoke<boolean>("is_devtools_open");
          if (isOpen) {
            await invoke("close_devtools");
            logger.debug("ui", "DevTools closed via F12");
          } else {
            await invoke("open_devtools");
            logger.debug("ui", "DevTools opened via F12");
          }
        } catch (error) {
          logger.error("ui", "Failed to toggle DevTools", { error });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null; // No UI
}
