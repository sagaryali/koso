"use client";

import {
  type ReactNode,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  separator?: boolean;
}

interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: "left" | "right";
  className?: string;
}

export function DropdownMenu({
  trigger,
  items,
  align = "left",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, close]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < items.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : items.length - 1
        );
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && !items[focusedIndex].disabled) {
          items[focusedIndex].onClick();
          close();
        }
        break;
    }
  };

  return (
    <div className={cn("relative inline-block", className)} onKeyDown={handleKeyDown}>
      <div
        ref={triggerRef}
        onClick={() => {
          setOpen(!open);
          if (!open) setFocusedIndex(0);
        }}
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </div>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            "absolute z-50 mt-1 min-w-[180px] rounded-none border border-border-strong bg-bg-primary py-1 shadow-modal",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, index) => (
            <div key={index}>
              {item.separator && index > 0 && (
                <div className="my-1 border-t border-border-default" />
              )}
              <button
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                className={cn(
                  "w-full cursor-pointer px-3 py-2 text-left text-sm text-text-primary transition-none",
                  "hover:bg-bg-hover",
                  "disabled:cursor-default disabled:opacity-50",
                  focusedIndex === index && "bg-bg-hover",
                  item.active && "font-bold"
                )}
                onClick={() => {
                  item.onClick();
                  close();
                }}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
