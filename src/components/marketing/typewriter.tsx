"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
  className?: string;
  showCursor?: boolean;
}

export function Typewriter({
  text,
  speed = 30,
  delay = 0,
  onComplete,
  className,
  showCursor = true,
}: TypewriterProps) {
  const [charIndex, setCharIndex] = useState(0);
  const [started, setStarted] = useState(delay === 0);

  useEffect(() => {
    if (delay > 0) {
      const timeout = setTimeout(() => setStarted(true), delay);
      return () => clearTimeout(timeout);
    }
  }, [delay]);

  const handleComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!started) return;
    if (charIndex >= text.length) {
      handleComplete();
      return;
    }

    const timeout = setTimeout(() => {
      setCharIndex((prev) => prev + 1);
    }, speed);

    return () => clearTimeout(timeout);
  }, [started, charIndex, text.length, speed, handleComplete]);

  return (
    <span className={cn(className)}>
      {text.slice(0, charIndex)}
      {showCursor && charIndex < text.length && (
        <span className="typewriter-cursor" />
      )}
    </span>
  );
}
