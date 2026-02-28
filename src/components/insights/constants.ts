import type { ClusterVerdict } from "@/types";

export const CRITICALITY_BADGE_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

export type EffortLevel = "Quick Win" | "Medium" | "Complex";

export const EFFORT_BADGE_COLORS: Record<EffortLevel, string> = {
  "Quick Win": "bg-green-100 text-green-800",
  Medium: "bg-yellow-100 text-yellow-800",
  Complex: "bg-red-100 text-red-800",
};

export interface EffortEstimate {
  label: string;
  effortLevel: EffortLevel;
  reason: string;
  affectedModuleCount: number;
}

export const VERDICT_PILL_COLORS: Record<ClusterVerdict, string> = {
  BUILD: "bg-green-100 text-green-800",
  MAYBE: "bg-yellow-100 text-yellow-800",
  SKIP: "bg-gray-100 text-gray-600",
};
