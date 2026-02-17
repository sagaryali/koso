import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({
  interactive = false,
  className,
  children,
  onClick,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-none border border-border-default bg-bg-primary p-6",
        interactive && "cursor-pointer hover:border-border-strong",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}
