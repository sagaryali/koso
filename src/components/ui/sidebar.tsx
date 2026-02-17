"use client";

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

interface SidebarItem {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

interface SidebarSection {
  label?: string;
  items: SidebarItem[];
}

interface SidebarProps {
  sections: SidebarSection[];
  collapsed?: boolean;
  onToggle?: () => void;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Sidebar({
  sections,
  collapsed = false,
  header,
  footer,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border-default bg-bg-secondary transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-[240px]",
        className
      )}
    >
      {header && (
        <div className="border-b border-border-default p-4">{header}</div>
      )}

      <nav className="flex-1 overflow-y-auto py-3">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className={cn(sectionIndex > 0 && "mt-5")}>
            {section.label && !collapsed && (
              <div className="px-4 pb-2 text-[11px] font-medium uppercase tracking-caps text-text-tertiary">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5 px-2">
              {section.items.map((item, itemIndex) => (
                <button
                  key={itemIndex}
                  onClick={item.onClick}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-none px-2 py-2 text-sm font-medium transition-none",
                    "cursor-pointer",
                    item.active
                      ? "bg-bg-inverse text-text-inverse"
                      : "text-text-primary hover:bg-bg-hover",
                    collapsed && "justify-center"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {item.icon && (
                    <Icon
                      icon={item.icon}
                      className={cn(
                        item.active ? "text-text-inverse" : "text-text-tertiary"
                      )}
                    />
                  )}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {footer && (
        <div className="border-t border-border-default p-4">{footer}</div>
      )}
    </aside>
  );
}
