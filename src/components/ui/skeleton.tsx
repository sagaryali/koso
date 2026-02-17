import { cn } from "@/lib/utils";

type SkeletonVariant = "text" | "block" | "list";

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  lines = 3,
  className,
}: SkeletonProps) {
  const baseClasses = "animate-pulse rounded-none bg-bg-tertiary";

  if (variant === "list") {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseClasses, "h-4")}
            style={{
              width: i === lines - 1 ? "60%" : "100%",
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === "block") {
    return (
      <div
        className={cn(baseClasses, className)}
        style={{
          width: width ?? "100%",
          height: height ?? 120,
        }}
      />
    );
  }

  // text variant
  return (
    <div
      className={cn(baseClasses, "h-4", className)}
      style={{ width: width ?? "100%" }}
    />
  );
}
