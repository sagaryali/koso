import { type LucideIcon, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps extends Omit<LucideProps, "ref"> {
  icon: LucideIcon;
}

export function Icon({ icon: LucideIcon, className, ...props }: IconProps) {
  return (
    <LucideIcon
      size={16}
      strokeWidth={1.5}
      className={cn("shrink-0", className)}
      {...props}
    />
  );
}
