"use client";

import { Dialog } from "./dialog";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="space-y-4">
        <h3 className="text-lg font-medium tracking-tight">{title}</h3>
        <p className="text-sm text-text-secondary">{description}</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={
              destructive
                ? "border-state-error bg-state-error text-white hover:opacity-90"
                : undefined
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
