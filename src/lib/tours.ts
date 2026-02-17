import type { TourStep } from "@/types/coach-mark";

export const HOME_TOUR: TourStep[] = [
  {
    target: '[data-tour="sidebar-nav"]',
    title: "Navigate your workspace",
    description:
      "Investigate research, manage evidence, connect your codebase, and adjust settings from the sidebar.",
    position: "right",
  },
  {
    target: '[data-tour="sidebar-new-spec"]',
    title: "Create a new spec",
    description:
      "Start a fresh PRD or user story. The editor will help you build on your evidence and codebase context.",
    position: "right",
  },
  {
    target: '[data-tour="home-insights"]',
    title: "Themes from your evidence",
    description:
      "Your customer feedback is automatically synthesized into key themes. Use these to decide what to build next.",
    position: "bottom",
  },
  {
    target: '[data-tour="home-quick-add"]',
    title: "Capture evidence fast",
    description:
      "Paste customer feedback, metrics, or notes here. They feed into your evidence pool and shape your insights.",
    position: "bottom",
  },
  {
    target: '[data-tour="home-timeline"]',
    title: "Recent activity",
    description:
      "See your latest specs and evidence at a glance. Click any item to jump straight to it.",
    position: "top",
  },
  {
    target: '[data-tour="sidebar-specs"]',
    title: "Your specs live here",
    description:
      "All your PRDs and user stories appear in the sidebar. Click one to open it in the editor.",
    position: "right",
  },
];

export const EDITOR_TOUR: TourStep[] = [
  {
    target: '[data-tour="editor-toolbar"]',
    title: "Editor toolbar",
    description:
      "Toggle the context panel, open the AI command palette with Cmd+K, and manage your spec here.",
    position: "bottom",
  },
  {
    target: '[data-tour="editor-content"]',
    title: "Write your spec",
    description:
      "A rich-text editor with headings, lists, code blocks, and tasks. Your work saves automatically.",
    position: "right",
  },
  {
    target: '[data-tour="editor-panel"]',
    title: "Context panel",
    description:
      "Related specs, customer evidence, and codebase modules appear here as you write.",
    position: "left",
  },
];

export const EVIDENCE_TOUR: TourStep[] = [
  {
    target: '[data-tour="evidence-add"]',
    title: "Add evidence",
    description:
      "Import customer feedback, metrics, research findings, or meeting notes to power your insights.",
    position: "bottom",
  },
  {
    target: '[data-tour="evidence-search"]',
    title: "Semantic search",
    description:
      "Search your evidence by meaning, not just keywords. Find related feedback even when the wording differs.",
    position: "bottom",
  },
  {
    target: '[data-tour="evidence-filters"]',
    title: "Filter by type",
    description:
      "Narrow down to feedback, metrics, research, or meeting notes to find exactly what you need.",
    position: "bottom",
  },
];
