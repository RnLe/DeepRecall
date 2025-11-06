/**
 * Portal component to render children outside the normal DOM hierarchy
 * Ensures modals and overlays are drawn on top of all other content
 */

import { ReactNode } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: ReactNode;
}

export function Portal({ children }: PortalProps) {
  const modalRoot = document.getElementById("modal-root");

  if (!modalRoot) {
    return null;
  }

  return createPortal(children, modalRoot);
}
