"use client";

import { Compass, HeartCrack, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { AI_ACTIONS, type AIAction } from "@/lib/ai/actions";

const ACTION_BUTTONS: { id: string; icon: typeof Compass; label: string }[] = [
  { id: "what_to_build_next", icon: Compass, label: "What should we build next?" },
  { id: "customer_struggles", icon: HeartCrack, label: "What are customers struggling with?" },
  { id: "unaddressed_feedback", icon: CircleAlert, label: "What feedback haven't we addressed?" },
];

interface InsightsActionBarProps {
  onAction: (action: AIAction) => void;
}

export function InsightsActionBar({ onAction }: InsightsActionBarProps) {
  return (
    <div className="flex items-center gap-2">
      {ACTION_BUTTONS.map(({ id, icon, label }) => {
        const action = AI_ACTIONS.find((a) => a.id === id);
        if (!action) return null;
        return (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            onClick={() => onAction(action)}
            className="gap-1.5 text-text-secondary hover:text-text-primary"
          >
            <Icon icon={icon} />
            {label}
          </Button>
        );
      })}
    </div>
  );
}
