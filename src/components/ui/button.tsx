import { type ButtonHTMLAttributes } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-bg-inverse text-text-inverse hover:bg-[#222222]",
  secondary:
    "bg-bg-primary text-text-primary border border-border-strong hover:bg-bg-tertiary",
  ghost:
    "bg-transparent text-text-primary hover:bg-bg-tertiary",
  danger:
    "bg-state-error text-white hover:bg-red-700",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3",
  md: "h-10 px-4",
  lg: "h-11 px-5",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-none text-sm font-medium whitespace-nowrap transition-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "cursor-pointer",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {icon && <Icon icon={icon} />}
      {children}
    </button>
  );
}
