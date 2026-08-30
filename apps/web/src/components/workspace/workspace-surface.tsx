"use client";

import { forwardRef, type ReactNode } from "react";

export const WorkspaceSurface = forwardRef<
  HTMLDivElement,
  { children: ReactNode; className?: string }
>(function WorkspaceSurface({ children, className = "" }, ref) {
  return (
    <div ref={ref} className={`relative ${className}`}>
      {children}
    </div>
  );
});
