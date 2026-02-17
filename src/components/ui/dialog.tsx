"use client";

import {
  type ReactNode,
  type HTMLAttributes,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({
  open,
  onClose,
  className,
  children,
  ...props
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onCloseRef.current();
      return;
    }

    if (e.key === "Tab") {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
  }, []);

  // Focus management: only run when open changes
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = "hidden";

      requestAnimationFrame(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const firstFocusable = dialog.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      });
    }

    return () => {
      document.body.style.overflow = "";
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [open]);

  // Keydown listener: stable callback, no re-registration needed
  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-[8px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full max-w-lg rounded-none border border-border-strong bg-bg-primary p-6 shadow-modal",
          className
        )}
        {...props}
      >
        <button
          onClick={() => onCloseRef.current()}
          className="absolute top-4 right-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-none text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
          aria-label="Close"
        >
          <Icon icon={X} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
