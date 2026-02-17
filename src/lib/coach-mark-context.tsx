"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { CoachMark } from "@/components/ui/coach-mark";
import type { TourStep } from "@/types/coach-mark";

interface ActiveTour {
  tourId: string;
  steps: TourStep[];
  currentStepIndex: number;
  workspaceId: string;
}

interface CoachMarkContextValue {
  startTour: (tourId: string, steps: TourStep[], workspaceId: string) => void;
  activeTour: ActiveTour | null;
}

const CoachMarkContext = createContext<CoachMarkContextValue>({
  startTour: () => {},
  activeTour: null,
});

function tourKey(workspaceId: string, tourId: string) {
  return `koso_tour_${workspaceId}_${tourId}`;
}

export function CoachMarkProvider({ children }: { children: ReactNode }) {
  const [activeTour, setActiveTour] = useState<ActiveTour | null>(null);
  const activeTourRef = useRef<ActiveTour | null>(null);
  activeTourRef.current = activeTour;

  const markComplete = useCallback((wId: string, tId: string) => {
    localStorage.setItem(tourKey(wId, tId), "completed");
    setActiveTour(null);
  }, []);

  const startTour = useCallback(
    (tourId: string, steps: TourStep[], workspaceId: string) => {
      if (activeTourRef.current) return;
      if (localStorage.getItem(tourKey(workspaceId, tourId)) === "completed")
        return;
      setActiveTour({ tourId, steps, currentStepIndex: 0, workspaceId });
    },
    []
  );

  const next = useCallback(() => {
    setActiveTour((prev) => {
      if (!prev) return null;
      const nextIndex = prev.currentStepIndex + 1;
      if (nextIndex >= prev.steps.length) {
        localStorage.setItem(
          tourKey(prev.workspaceId, prev.tourId),
          "completed"
        );
        return null;
      }
      return { ...prev, currentStepIndex: nextIndex };
    });
  }, []);

  const back = useCallback(() => {
    setActiveTour((prev) => {
      if (!prev || prev.currentStepIndex === 0) return prev;
      return { ...prev, currentStepIndex: prev.currentStepIndex - 1 };
    });
  }, []);

  const skip = useCallback(() => {
    const tour = activeTourRef.current;
    if (!tour) return;
    markComplete(tour.workspaceId, tour.tourId);
  }, [markComplete]);

  const step = activeTour?.steps[activeTour.currentStepIndex];

  return (
    <CoachMarkContext.Provider value={{ startTour, activeTour }}>
      {children}
      {activeTour && step && (
        <CoachMark
          target={step.target}
          title={step.title}
          description={step.description}
          position={step.position}
          currentStep={activeTour.currentStepIndex + 1}
          totalSteps={activeTour.steps.length}
          onNext={next}
          onBack={back}
          onSkip={skip}
        />
      )}
    </CoachMarkContext.Provider>
  );
}

export function useCoachMarks() {
  return useContext(CoachMarkContext);
}
