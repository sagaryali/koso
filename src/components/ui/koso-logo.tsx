import { cn } from "@/lib/utils";

/**
 * The Koso mark — a Bauhaus-style "K" built from stacked rectangular blocks in a black square.
 * Used in the sidebar (collapsed), favicon, and anywhere a compact brand mark is needed.
 */
function KosoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-label="Koso"
    >
      <rect width="24" height="24" fill="currentColor" />
      {/* Stem */}
      <rect x="4.5" y="3" width="4" height="18" fill="white" />
      {/* Upper arm — stepped blocks */}
      <rect x="8.5" y="7" width="4" height="4.5" fill="white" />
      <rect x="12.5" y="3" width="4.5" height="4.5" fill="white" />
      {/* Lower arm — stepped blocks */}
      <rect x="8.5" y="12.5" width="4" height="4.5" fill="white" />
      <rect x="12.5" y="16.5" width="4.5" height="4.5" fill="white" />
    </svg>
  );
}

/**
 * The full Koso wordmark — mark + "Koso" text.
 * Used in the sidebar header, auth pages, and onboarding.
 */
function KosoWordmark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <KosoMark size={size} />
      <span
        className="font-bold tracking-tight"
        style={{ fontSize: size * 0.75, lineHeight: 1 }}
      >
        Koso
      </span>
    </span>
  );
}

export { KosoMark, KosoWordmark };
