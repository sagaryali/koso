export type SourceType = "artifact" | "evidence" | "codebase_module";

export type ContextStrategy = "evidence_first" | "code_first" | "balanced";

export interface SectionConfig {
  heading: string;
  codeWeight: number; // 0 = all evidence, 1 = all code
  sourceTypes: SourceType[];
  dependsOn: string[]; // prior section headings
  guidance: string;
  contextStrategy: ContextStrategy;
}

// --- PRD Template Sections ---

const PRD_SECTIONS: SectionConfig[] = [
  {
    heading: "Problem",
    codeWeight: 0.1,
    sourceTypes: ["evidence"],
    dependsOn: [],
    guidance: "Ground every statement in customer evidence.",
    contextStrategy: "evidence_first",
  },
  {
    heading: "Goals & Success Metrics",
    codeWeight: 0.2,
    sourceTypes: ["evidence", "artifact"],
    dependsOn: ["Problem"],
    guidance: "Each goal maps to a problem above. Metrics tied to evidence.",
    contextStrategy: "evidence_first",
  },
  {
    heading: "User Stories",
    codeWeight: 0.3,
    sourceTypes: ["evidence", "artifact"],
    dependsOn: ["Problem", "Goals & Success Metrics"],
    guidance:
      "Each story traces to a goal. Personas from evidence.",
    contextStrategy: "evidence_first",
  },
  {
    heading: "Requirements",
    codeWeight: 0.7,
    sourceTypes: ["evidence", "artifact", "codebase_module"],
    dependsOn: ["Problem", "Goals & Success Metrics", "User Stories"],
    guidance:
      "Reference specific codebase modules. Architecture constraints.",
    contextStrategy: "code_first",
  },
  {
    heading: "Open Questions",
    codeWeight: 0.5,
    sourceTypes: ["evidence", "artifact", "codebase_module"],
    dependsOn: [
      "Problem",
      "Goals & Success Metrics",
      "User Stories",
      "Requirements",
    ],
    guidance: "Flag gaps and conflicts across all prior sections.",
    contextStrategy: "balanced",
  },
];

// --- One-Pager Template Sections ---

const ONE_PAGER_SECTIONS: SectionConfig[] = [
  {
    heading: "TL;DR",
    codeWeight: 0.2,
    sourceTypes: ["evidence"],
    dependsOn: [],
    guidance: "One-paragraph summary grounded in evidence.",
    contextStrategy: "evidence_first",
  },
  {
    heading: "Context",
    codeWeight: 0.2,
    sourceTypes: ["evidence", "artifact"],
    dependsOn: ["TL;DR"],
    guidance: "Why now? Reference market signals and customer trends.",
    contextStrategy: "evidence_first",
  },
  {
    heading: "Proposal",
    codeWeight: 0.5,
    sourceTypes: ["evidence", "artifact", "codebase_module"],
    dependsOn: ["TL;DR", "Context"],
    guidance: "What are we doing? Reference codebase when relevant.",
    contextStrategy: "balanced",
  },
  {
    heading: "Risks & Mitigations",
    codeWeight: 0.6,
    sourceTypes: ["evidence", "artifact", "codebase_module"],
    dependsOn: ["TL;DR", "Context", "Proposal"],
    guidance: "Technical and product risks. Reference code constraints.",
    contextStrategy: "code_first",
  },
  {
    heading: "Next Steps",
    codeWeight: 0.4,
    sourceTypes: ["evidence", "artifact", "codebase_module"],
    dependsOn: ["TL;DR", "Context", "Proposal", "Risks & Mitigations"],
    guidance: "Actionable next steps with owners.",
    contextStrategy: "balanced",
  },
];

// --- User Story Template Sections ---

const USER_STORY_SECTIONS: SectionConfig[] = [
  {
    heading: "User Story",
    codeWeight: 0.2,
    sourceTypes: ["evidence"],
    dependsOn: [],
    guidance: "Ground the story in customer evidence and personas.",
    contextStrategy: "evidence_first",
  },
  {
    heading: "Acceptance Criteria",
    codeWeight: 0.6,
    sourceTypes: ["evidence", "codebase_module"],
    dependsOn: ["User Story"],
    guidance: "Specific, testable criteria. Reference code when relevant.",
    contextStrategy: "code_first",
  },
  {
    heading: "Notes",
    codeWeight: 0.4,
    sourceTypes: ["evidence", "artifact", "codebase_module"],
    dependsOn: ["User Story", "Acceptance Criteria"],
    guidance: "Additional context, dependencies, and open items.",
    contextStrategy: "balanced",
  },
];

// --- Fallback for unknown sections ---

const FALLBACK_CONFIG: SectionConfig = {
  heading: "",
  codeWeight: 0.4,
  sourceTypes: ["evidence", "artifact", "codebase_module"],
  dependsOn: [],
  guidance: "Balanced context from all sources.",
  contextStrategy: "balanced",
};

// --- Template type to sections map ---

const TEMPLATE_SECTIONS: Record<string, SectionConfig[]> = {
  prd: PRD_SECTIONS,
  one_pager: ONE_PAGER_SECTIONS,
  user_story: USER_STORY_SECTIONS,
};

/**
 * Get the SectionConfig for a given section heading and optional template type.
 * Falls back to a balanced config if the section is unknown.
 */
export function getSectionConfig(
  sectionName: string,
  templateType?: string
): SectionConfig {
  const normalizedName = sectionName.trim();

  // Try template-specific sections first
  if (templateType) {
    const sections = TEMPLATE_SECTIONS[templateType];
    if (sections) {
      const match = sections.find(
        (s) => s.heading.toLowerCase() === normalizedName.toLowerCase()
      );
      if (match) return match;
    }
  }

  // Try all templates as fallback
  for (const sections of Object.values(TEMPLATE_SECTIONS)) {
    const match = sections.find(
      (s) => s.heading.toLowerCase() === normalizedName.toLowerCase()
    );
    if (match) return match;
  }

  return { ...FALLBACK_CONFIG, heading: normalizedName };
}

/**
 * Get all section configs for a template type.
 */
export function getTemplateSections(
  templateType: string
): SectionConfig[] {
  return TEMPLATE_SECTIONS[templateType] ?? [];
}

/**
 * Compute result count allocations based on codeWeight.
 * Returns { evidence, code, specs } counts.
 */
export function getResultAllocations(codeWeight: number): {
  evidence: number;
  code: number;
  specs: number;
} {
  return {
    evidence: Math.ceil(8 * (1 - codeWeight)),
    code: Math.ceil(8 * codeWeight),
    specs: 3,
  };
}
