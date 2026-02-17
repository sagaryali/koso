import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BrowserFrameProps {
  children: ReactNode;
  url?: string;
  className?: string;
}

export function BrowserFrame({
  children,
  url = "app.koso.ai",
  className,
}: BrowserFrameProps) {
  return (
    <div
      className={cn(
        "border border-border-default bg-bg-primary overflow-hidden",
        className
      )}
    >
      {/* Title bar */}
      <div className="flex items-center h-10 bg-bg-secondary border-b border-border-default px-4 gap-2">
        <div className="flex gap-1.5">
          <div className="w-[10px] h-[10px] rounded-full bg-border-default" />
          <div className="w-[10px] h-[10px] rounded-full bg-border-default" />
          <div className="w-[10px] h-[10px] rounded-full bg-border-default" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-bg-tertiary px-3 py-0.5 text-xs text-text-tertiary">
            {url}
          </div>
        </div>
        <div className="w-[46px]" />
      </div>

      {/* Content area */}
      <div className="relative overflow-hidden">{children}</div>
    </div>
  );
}
