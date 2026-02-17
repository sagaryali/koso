"use client";

import { useEffect, useRef } from "react";
import { useCoachMarks } from "@/lib/coach-mark-context";
import { useWorkspace } from "@/lib/workspace-context";
import type { TourStep } from "@/types/coach-mark";

export function useTourTrigger(
  tourId: string,
  steps: TourStep[],
  delay = 500
) {
  const { startTour } = useCoachMarks();
  const { workspace } = useWorkspace();
  const triggered = useRef(false);

  useEffect(() => {
    if (!workspace || triggered.current) return;
    triggered.current = true;

    const timer = setTimeout(() => {
      startTour(tourId, steps, workspace.id);
    }, delay);

    return () => clearTimeout(timer);
  }, [workspace?.id]);
}
