"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children as the printed sheet and nothing else.
 *
 * `window.print()` prints the whole document, so a receipt triggered from a
 * dialog otherwise spools the scrolled page underneath with the dialog stamped
 * on top. This mounts the document straight onto `<body>` — outside the
 * dialog's portal and its stacking context — where the print rules in
 * globals.css hide every other top-level node.
 *
 * Nothing here is visible on screen; it exists only for the printer.
 */
export function PrintDocument({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const node = document.createElement("div");
    node.className = "print-root";
    document.body.appendChild(node);
    setHost(node);
    return () => {
      node.remove();
    };
  }, []);

  if (!host) return null;

  return createPortal(
    <div className="print-only" role="document">
      {children}
    </div>,
    host,
  );
}
