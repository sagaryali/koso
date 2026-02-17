"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./button";

interface CoachMarkProps {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const TOOLTIP_WIDTH = 280;
const PADDING = 8;
const GAP = 12;
const VIEWPORT_MARGIN = 16;

function getTargetRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
}

function computeTooltipPosition(
  rect: DOMRect,
  preferred: "top" | "bottom" | "left" | "right",
  tooltipHeight: number
) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const fits = {
    bottom: rect.bottom + PADDING + GAP + tooltipHeight + VIEWPORT_MARGIN < vh,
    top: rect.top - PADDING - GAP - tooltipHeight - VIEWPORT_MARGIN > 0,
    right: rect.right + PADDING + GAP + TOOLTIP_WIDTH + VIEWPORT_MARGIN < vw,
    left: rect.left - PADDING - GAP - TOOLTIP_WIDTH - VIEWPORT_MARGIN > 0,
  };

  const order: ("top" | "bottom" | "left" | "right")[] = [
    preferred,
    preferred === "top"
      ? "bottom"
      : preferred === "bottom"
        ? "top"
        : preferred === "left"
          ? "right"
          : "left",
    "bottom",
    "top",
    "right",
    "left",
  ];

  const side = order.find((s) => fits[s]) ?? "bottom";

  let top = 0;
  let left = 0;

  switch (side) {
    case "bottom":
      top = rect.bottom + PADDING + GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case "top":
      top = rect.top - PADDING - GAP - tooltipHeight;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case "right":
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + PADDING + GAP;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - PADDING - GAP - TOOLTIP_WIDTH;
      break;
  }

  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN)
  );
  top = Math.max(
    VIEWPORT_MARGIN,
    Math.min(top, vh - tooltipHeight - VIEWPORT_MARGIN)
  );

  return { top, left };
}

export function CoachMark({
  target,
  title,
  description,
  position: preferredPosition = "bottom",
  currentStep,
  totalSteps,
  onNext,
  onBack,
  onSkip,
}: CoachMarkProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const updatePosition = useCallback(() => {
    const r = getTargetRect(target);
    if (!r) {
      onNext();
      return;
    }
    setRect(r);

    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 160;
    setTooltipPos(computeTooltipPosition(r, preferredPosition, tooltipHeight));
  }, [target, preferredPosition, onNext]);

  // Scroll target into view, then position overlay
  useEffect(() => {
    const targetEl = document.querySelector(target);
    if (!targetEl) {
      onNext();
      return;
    }

    // Scroll into view first, then update position after scroll settles
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    const scrollTimer = setTimeout(updatePosition, 400);

    const handleLayout = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updatePosition);
    };

    window.addEventListener("resize", handleLayout);
    window.addEventListener("scroll", handleLayout, true);

    let observer: ResizeObserver | undefined;
    observer = new ResizeObserver(handleLayout);
    observer.observe(targetEl);

    return () => {
      clearTimeout(scrollTimer);
      window.removeEventListener("resize", handleLayout);
      window.removeEventListener("scroll", handleLayout, true);
      cancelAnimationFrame(rafRef.current);
      observer?.disconnect();
    };
  }, [target, updatePosition]);

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onSkip]);

  // Prevent wheel/touch scrolling on the overlay (clicks pass through the SVG cutout)
  useEffect(() => {
    const preventScroll = (e: WheelEvent | TouchEvent) => {
      // Allow scrolling if the event target is inside the spotlight cutout (the actual target element)
      const targetEl = document.querySelector(target);
      if (targetEl && targetEl.contains(e.target as Node)) return;
      e.preventDefault();
    };
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });
    return () => {
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
    };
  }, [target]);

  if (!rect) return null;

  const cutout = {
    x: rect.x - PADDING,
    y: rect.y - PADDING,
    w: rect.width + PADDING * 2,
    h: rect.height + PADDING * 2,
  };

  const isFirst = currentStep === 1;
  const isLast = currentStep === totalSteps;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {/* SVG overlay with spotlight cutout */}
        <svg className="fixed inset-0 h-full w-full" style={{ zIndex: 70 }}>
          <defs>
            <mask id="coach-mark-mask">
              <rect fill="white" width="100%" height="100%" />
              <rect
                fill="black"
                x={cutout.x}
                y={cutout.y}
                width={cutout.w}
                height={cutout.h}
              />
            </mask>
          </defs>
          <rect
            fill="rgba(0,0,0,0.5)"
            width="100%"
            height="100%"
            mask="url(#coach-mark-mask)"
          />
        </svg>

        {/* Tooltip */}
        <motion.div
          ref={tooltipRef}
          className="fixed border border-border-strong bg-bg-primary p-5 shadow-modal"
          style={{
            zIndex: 71,
            width: TOOLTIP_WIDTH,
            top: tooltipPos.top,
            left: tooltipPos.left,
          }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          key={`${target}-${currentStep}`}
        >
          {/* Header row */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
              Step {currentStep} of {totalSteps}
            </span>
            <button
              onClick={onSkip}
              className="cursor-pointer text-xs text-text-tertiary hover:text-text-primary"
            >
              Skip
            </button>
          </div>

          {/* Content */}
          <div className="mt-3 text-sm font-medium text-text-primary">
            {title}
          </div>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>

          {/* Actions */}
          <div className="mt-4 flex items-center justify-end gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                Back
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onNext}>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
