/**
 * Portal component to render children outside the normal DOM hierarchy
 * Ensures modals and overlays are drawn on top of all other content
 */

import { useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: ReactNode;
}

export function Portal({ children }: PortalProps) {
  const modalRoot = useRef<HTMLElement | null>(null);

  useEffect(() => {
    modalRoot.current = document.getElementById("modal-root");
  }, []);

  if (!modalRoot.current) {
    return null;
  }

  return createPortal(children, modalRoot.current);
}
