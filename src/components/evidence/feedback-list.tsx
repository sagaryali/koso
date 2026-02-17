"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import type { FeedbackItem } from "@/lib/parse-feedback";

interface FeedbackListProps {
  items: FeedbackItem[];
  onUpdateItem: (id: string, content: string) => void;
  onRemoveItem: (id: string) => void;
}

export function FeedbackList({
  items,
  onUpdateItem,
  onRemoveItem,
}: FeedbackListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editingId]);

  return (
    <div>
      <p className="mb-3 text-xs text-text-tertiary">
        {items.length} {items.length === 1 ? "item" : "items"} detected
      </p>

      <div className="max-h-[320px] space-y-2 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 border border-border-default p-6"
          >
            <div className="min-w-0 flex-1">
              {editingId === item.id ? (
                <textarea
                  ref={textareaRef}
                  defaultValue={item.content}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && val !== item.content) {
                      onUpdateItem(item.id, val);
                    }
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  className="w-full resize-none border border-border-default bg-bg-primary px-2 py-1 text-sm text-text-primary focus:border-border-strong focus:outline-none"
                />
              ) : (
                <p
                  onClick={() => setEditingId(item.id)}
                  className="cursor-text text-sm text-text-primary"
                >
                  {item.content}
                </p>
              )}
              {item.title && (
                <p className="mt-1 text-xs text-text-tertiary">{item.title}</p>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveItem(item.id)}
              aria-label="Remove item"
            >
              <Icon icon={X} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
