"use client";

import { Dialog } from "@/components/ui";
import { SHORTCUTS } from "@/hooks/use-keyboard-shortcuts";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({
  open,
  onClose,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Keyboard Shortcuts</h2>
        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3">
          {SHORTCUTS.map((s) => (
            <div key={s.key + (s.shift ? "-shift" : "")} className="flex items-center justify-between gap-4">
              <span className="text-sm text-text-secondary">
                {s.description}
              </span>
              <kbd className="shrink-0 bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-primary">
                {s.label}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
