"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResizablePanelProps {
  width?: number;
  collapsed?: boolean;
  onToggle?: () => void;
  children: ReactNode;
  className?: string;
}

export function ResizablePanel({
  width = 320,
  collapsed = false,
  children,
  className,
}: ResizablePanelProps) {
  return (
    <aside
      className={cn(
        "shrink-0 overflow-hidden border-l border-border-default bg-bg-primary transition-[width] duration-200 ease-out",
        className
      )}
      style={{ width: collapsed ? 0 : width }}
    >
      {!collapsed && (
        <div className="h-full overflow-y-auto">{children}</div>
      )}
    </aside>
  );
}
