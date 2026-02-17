import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  helperText?: string;
  error?: string;
}

export function Input({
  label,
  helperText,
  error,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

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
      <input
        id={inputId}
        className={cn(
          "h-10 w-full rounded-none border bg-bg-primary px-3 text-sm text-text-primary transition-none",
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
