import type { ArtifactType } from "@/types";

export interface SpecTemplate {
  id: string;
  label: string;
  description: string;
  type: ArtifactType;
  content: Record<string, unknown>;
}

function heading(level: number, text: string) {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function paragraph(text?: string) {
  if (!text) return { type: "paragraph" };
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

function taskItem(text: string) {
  return {
    type: "taskItem",
    attrs: { checked: false },
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

export const SPEC_TEMPLATES: SpecTemplate[] = [
  {
    id: "blank",
    label: "Blank",
    description: "Start from scratch",
    type: "prd",
    content: {},
  },
  {
    id: "prd",
    label: "PRD",
    description: "Problem, goals, requirements",
    type: "prd",
    content: {
      type: "doc",
      content: [
        heading(2, "Problem"),
        paragraph("What problem are we solving and for whom?"),
        heading(2, "Goals & Success Metrics"),
        paragraph("How will we measure success?"),
        heading(2, "User Stories"),
        paragraph("Key user flows and scenarios."),
        heading(2, "Requirements"),
        paragraph("What needs to be true for this to ship?"),
        heading(2, "Open Questions"),
        paragraph("What do we still need to figure out?"),
      ],
    },
  },
  {
    id: "user_story",
    label: "User Story",
    description: "As a user, I want to...",
    type: "user_story",
    content: {
      type: "doc",
      content: [
        heading(2, "User Story"),
        paragraph("As a [user type], I want to [action] so that [benefit]."),
        heading(2, "Acceptance Criteria"),
        {
          type: "taskList",
          content: [
            taskItem("Criterion 1"),
            taskItem("Criterion 2"),
            taskItem("Criterion 3"),
          ],
        },
        heading(2, "Notes"),
        paragraph(),
      ],
    },
  },
  {
    id: "one_pager",
    label: "One-Pager",
    description: "Quick proposal with context",
    type: "prd",
    content: {
      type: "doc",
      content: [
        heading(2, "TL;DR"),
        paragraph("One-paragraph summary of the proposal."),
        heading(2, "Context"),
        paragraph("Why now? What's changed?"),
        heading(2, "Proposal"),
        paragraph("What are we doing and how?"),
        heading(2, "Risks & Mitigations"),
        paragraph("What could go wrong and how do we handle it?"),
        heading(2, "Next Steps"),
        paragraph("What happens after this is approved?"),
      ],
    },
  },
];
