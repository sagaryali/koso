"use client";

import { type TextareaHTMLAttributes, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export function TextArea({
  label,
  helperText,
  error,
  className,
  id,
  onChange,
  value,
  defaultValue,
  ...props
}: TextAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxH = parseInt(getComputedStyle(textarea).maxHeight, 10);
    const desired = Math.max(80, textarea.scrollHeight);
    if (maxH && !isNaN(maxH) && desired > maxH) {
      textarea.style.height = `${maxH}px`;
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.height = `${desired}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, defaultValue, adjustHeight]);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}
      <textarea
        ref={textareaRef}
        id={inputId}
        className={cn(
          "min-h-[80px] w-full resize-none rounded-none border bg-bg-primary px-3 py-2.5 text-sm text-text-primary transition-none",
          "placeholder:text-text-tertiary",
          "focus:border-border-strong focus:outline-none",
          error ? "border-state-error" : "border-border-default",
          className
        )}
        aria-invalid={!!error}
        aria-describedby={
          error
            ? `${inputId}-error`
            : helperText
              ? `${inputId}-helper`
              : undefined
        }
        onChange={(e) => {
          onChange?.(e);
          adjustHeight();
        }}
        value={value}
        defaultValue={defaultValue}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-state-error">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${inputId}-helper`} className="mt-1.5 text-xs text-text-tertiary">
          {helperText}
        </p>
      )}
    </div>
  );
}
