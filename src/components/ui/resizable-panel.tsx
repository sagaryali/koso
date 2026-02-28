"use client";

import { type ReactNode, useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface ResizablePanelProps {
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  collapsed?: boolean;
  onToggle?: () => void;
  onWidthChange?: (width: number) => void;
  children: ReactNode;
  className?: string;
}

export function ResizablePanel({
  width = 320,
  minWidth = 280,
  maxWidth = 600,
  collapsed = false,
  onWidthChange,
  children,
  className,
}: ResizablePanelProps) {
  const [dragging, setDragging] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Use drag width while dragging, otherwise use the prop
  const displayWidth = dragWidth ?? width;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);

      const startX = e.clientX;
      const startWidth = dragWidth ?? width;

      function onMouseMove(ev: MouseEvent) {
        const delta = startX - ev.clientX;
        const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
        setDragWidth(newWidth);
        onWidthChange?.(newWidth);
      }

      function onMouseUp() {
        setDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [dragWidth, width, minWidth, maxWidth, onWidthChange]
  );

  return (
    <aside
      ref={panelRef}
      className={cn(
        "relative h-full shrink-0 overflow-hidden border-l border-border-default bg-bg-primary",
        !dragging && "transition-[width] duration-200 ease-out",
        className
      )}
      style={{ width: collapsed ? 0 : displayWidth }}
    >
      {!collapsed && (
        <>
          {/* Drag handle */}
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 left-0 z-10 h-full w-1 cursor-col-resize hover:bg-border-strong active:bg-border-strong"
          />
          <div className="h-full overflow-y-auto overscroll-contain">{children}</div>
        </>
      )}
    </aside>
  );
}
