export interface TourStep {
  /** CSS selector for the target element (e.g. '[data-tour="home-insights"]') */
  target: string;
  /** Short tooltip title */
  title: string;
  /** 1-2 sentence description */
  description: string;
  /** Preferred tooltip position. Auto-adjusts if insufficient space. */
  position?: "top" | "bottom" | "left" | "right";
}

export interface TourDefinition {
  id: string;
  steps: TourStep[];
}
