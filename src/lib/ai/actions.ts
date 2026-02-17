export type ContextStrategy =
  | "full_doc"
  | "full_doc_with_specs"
  | "evidence_search"
  | "doc_with_code"
  | "market_research"
  | "market_competitors"
  | "market_feasibility"
  | "all";

export type OutputMode =
  | "stream"
  | "stream_with_insert"
  | "stream_with_artifacts"
  | "stream_with_checklist";

export interface AIAction {
  id: string;
  label: string;
  description: string;
  promptTemplate: string;
  contextStrategy: ContextStrategy;
  outputMode: OutputMode;
  extractParam?: (input: string) => string | null;
}

export const AI_ACTIONS: AIAction[] = [
  {
    id: "generate_user_stories",
    label: "Generate user stories",
    description: "Create user stories with acceptance criteria from this PRD",
    promptTemplate:
      "Based on the PRD provided, generate detailed user stories with acceptance criteria. " +
      "For each story, provide:\n" +
      "- A clear title in the format \"As a [persona], I want [goal], so that [benefit]\"\n" +
      "- A description with context\n" +
      "- Acceptance criteria as a numbered list\n" +
      "- Priority suggestion (P0/P1/P2)\n\n" +
      "Separate each user story with a horizontal rule (---). Be thorough but practical.",
    contextStrategy: "full_doc",
    outputMode: "stream_with_artifacts",
  },
  {
    id: "check_conflicts",
    label: "Check for conflicts",
    description:
      "Find overlaps, contradictions, and dependency issues with other specs",
    promptTemplate:
      "Compare the current specification against the other existing specifications provided as context. " +
      "Identify:\n" +
      "1. **Scope overlaps** — features or requirements that duplicate existing work\n" +
      "2. **Contradictions** — requirements that conflict with existing specs\n" +
      "3. **Dependency issues** — assumptions that depend on unfinished or unplanned work\n" +
      "4. **Duplicate scope** — work that another spec already covers\n\n" +
      "For each conflict found, provide:\n" +
      "- **Severity**: HIGH, MEDIUM, or LOW\n" +
      "- **Type**: overlap, contradiction, dependency, or duplicate\n" +
      "- **Description**: what the conflict is\n" +
      "- **Affected spec**: which other spec is involved\n" +
      "- **Suggestion**: how to resolve it\n\n" +
      "If no conflicts are found, say so clearly.",
    contextStrategy: "full_doc_with_specs",
    outputMode: "stream",
  },
  {
    id: "summarize_feedback",
    label: "Summarize feedback about...",
    description: "Synthesize customer feedback into themes and patterns",
    promptTemplate:
      "Synthesize the customer feedback and evidence provided about \"{param}\" into a clear summary. " +
      "Include:\n" +
      "1. **Key themes** — recurring patterns across feedback\n" +
      "2. **Sentiment** — overall positive/negative/mixed with breakdown\n" +
      "3. **Key quotes** — the most representative or impactful direct quotes\n" +
      "4. **Recommendations** — actionable insights for the product team\n\n" +
      "Ground every observation in the actual evidence provided. Do not invent feedback.",
    contextStrategy: "evidence_search",
    outputMode: "stream_with_insert",
    extractParam: (input: string) => {
      const match = input.match(
        /summarize feedback about\s+(.+)/i
      );
      return match?.[1]?.trim() || null;
    },
  },
  {
    id: "rewrite_for_audience",
    label: "Rewrite for...",
    description: "Rewrite the document for a specific audience",
    promptTemplate:
      "Rewrite the following content for a {param} audience. " +
      "Adjust the language, detail level, and framing appropriately:\n" +
      "- For **engineering**: focus on technical requirements, constraints, edge cases, and implementation details\n" +
      "- For **executives**: focus on business impact, timelines, risks, and strategic alignment\n" +
      "- For **stakeholders**: focus on user value, scope, dependencies, and milestones\n\n" +
      "Maintain all the substantive information but reshape the presentation.",
    contextStrategy: "full_doc",
    outputMode: "stream_with_insert",
    extractParam: (input: string) => {
      const match = input.match(/rewrite for\s+(.+)/i);
      return match?.[1]?.trim() || null;
    },
  },
  {
    id: "suggest_edge_cases",
    label: "Suggest edge cases",
    description:
      "Identify edge cases, error scenarios, and security concerns",
    promptTemplate:
      "Review the specification and identify:\n" +
      "1. **Edge cases** — unusual but valid scenarios that need handling\n" +
      "2. **Error scenarios** — what can go wrong and how should the system respond\n" +
      "3. **Accessibility concerns** — WCAG compliance issues or usability gaps\n" +
      "4. **Security considerations** — potential vulnerabilities or data handling issues\n" +
      "5. **Performance risks** — scenarios that could cause degraded performance\n\n" +
      "Format each as a checklist item with a brief explanation. Be specific to this spec, not generic.",
    contextStrategy: "doc_with_code",
    outputMode: "stream_with_checklist",
  },
  {
    id: "draft_acceptance_criteria",
    label: "Draft acceptance criteria",
    description:
      "Generate detailed acceptance criteria in Given/When/Then format",
    promptTemplate:
      "Generate detailed acceptance criteria for the content provided. " +
      "Use the Given/When/Then format for each criterion:\n\n" +
      "**Given** [precondition]\n" +
      "**When** [action]\n" +
      "**Then** [expected result]\n\n" +
      "Cover the happy path, edge cases, and error states. " +
      "Group criteria by feature area if there are multiple distinct features.",
    contextStrategy: "full_doc",
    outputMode: "stream_with_insert",
  },
  {
    id: "engineering_approach",
    label: "How would engineering build this?",
    description:
      "Generate a technical approach referencing specific files and modules",
    promptTemplate:
      "Based on the specification and the codebase context provided, generate a detailed technical approach document. " +
      "You MUST reference specific files and modules from the codebase. Include:\n\n" +
      "1. **Architecture overview** — how this feature fits into the existing system\n" +
      "2. **Files to modify** — list each file that needs changes, with a description of what changes\n" +
      "3. **New files to create** — any new files needed, with their purpose and location\n" +
      "4. **Data model changes** — any database schema or type changes required\n" +
      "5. **Integration points** — how this connects to existing code (imports, API calls, shared state)\n" +
      "6. **Suggested implementation order** — what to build first, second, etc.\n\n" +
      "Be specific. Reference actual file paths, function names, and module exports from the codebase context.",
    contextStrategy: "doc_with_code",
    outputMode: "stream_with_insert",
  },
  {
    id: "effort_estimate",
    label: "What's the effort estimate?",
    description:
      "Estimate t-shirt size (S/M/L/XL) with reasoning based on codebase",
    promptTemplate:
      "Based on the specification and the codebase context provided, estimate the engineering effort. " +
      "Provide:\n\n" +
      "## T-Shirt Size: [S / M / L / XL]\n\n" +
      "**Reasoning:**\n" +
      "Consider and enumerate:\n" +
      "1. **Files affected** — how many existing files need changes (list them)\n" +
      "2. **New infrastructure** — any new services, APIs, or systems needed\n" +
      "3. **Data model changes** — schema migrations, new tables, type changes\n" +
      "4. **Testing complexity** — unit tests, integration tests, edge cases to cover\n" +
      "5. **Risk factors** — unknowns, dependencies on external systems, performance concerns\n\n" +
      "**Breakdown:**\n" +
      "Provide a rough breakdown of effort by area (e.g., Frontend: M, Backend: S, Data: L).\n\n" +
      "Ground your estimate in the actual codebase structure. Reference specific files and patterns.",
    contextStrategy: "doc_with_code",
    outputMode: "stream_with_insert",
  },
  {
    id: "codebase_changes",
    label: "What needs to change in the codebase?",
    description:
      "List specific files that need modification and what changes each needs",
    promptTemplate:
      "Based on the specification and the codebase context provided, create a detailed checklist of codebase changes. " +
      "For each change, provide:\n\n" +
      "- [ ] **File path** — What needs to change and why\n\n" +
      "Organize by category:\n\n" +
      "### Files to Modify\n" +
      "List each existing file that needs changes. For each, describe the specific modifications.\n\n" +
      "### New Files to Create\n" +
      "List any new files needed. Include the suggested path and purpose.\n\n" +
      "### Database / Schema Changes\n" +
      "Any migrations, new tables, or column changes.\n\n" +
      "### Configuration Changes\n" +
      "Environment variables, config files, or infrastructure updates.\n\n" +
      "Be specific and exhaustive. Reference actual file paths from the codebase context.",
    contextStrategy: "doc_with_code",
    outputMode: "stream_with_checklist",
  },

  // --- Market Research Actions ---

  {
    id: "research_feature",
    label: "Research this feature",
    description:
      "Search the web for competitor implementations, market trends, and best practices",
    promptTemplate:
      "You are given a product specification and market research results from web searches.\n\n" +
      "Synthesize a market analysis covering:\n\n" +
      "## Competitor Landscape\n" +
      "How do competitors handle this feature? What are their approaches, strengths, and weaknesses?\n\n" +
      "## Market Demand Signals\n" +
      "What evidence exists that this feature is in demand? Reference specific trends or data points.\n\n" +
      "## Best Practices\n" +
      "What are the established UX patterns and implementation best practices for this type of feature?\n\n" +
      "## Differentiation Opportunities\n" +
      "Based on what competitors are doing, where are the gaps? How could this product stand out?\n\n" +
      "Ground every observation in the actual search results provided. Cite sources by name when possible.",
    contextStrategy: "market_research",
    outputMode: "stream_with_insert",
  },
  {
    id: "find_competitors",
    label: "Find competitors doing...",
    description:
      "Search for how competitors implement a specific feature or capability",
    promptTemplate:
      "You are given market research results about competitors implementing \"{param}\".\n\n" +
      "For each competitor found, provide:\n\n" +
      "### [Competitor Name]\n" +
      "- **What they do**: Brief description of their implementation\n" +
      "- **Pros**: What works well about their approach\n" +
      "- **Cons**: Limitations or weaknesses\n" +
      "- **Source**: Where this information came from\n\n" +
      "End with a **Summary** comparing the approaches and identifying the strongest patterns.\n\n" +
      "Only include competitors with concrete information from the search results. Do not speculate.",
    contextStrategy: "market_competitors",
    outputMode: "stream_with_insert",
    extractParam: (input: string) => {
      const match = input.match(
        /find competitors doing\s+(.+)/i
      );
      return match?.[1]?.trim() || null;
    },
  },
  {
    id: "is_worth_building",
    label: "Is this feature worth building?",
    description:
      "Assess customer demand, market validation, and technical effort to give a build/skip recommendation",
    promptTemplate:
      "You are given:\n" +
      "1. A product specification for a feature being considered\n" +
      "2. Customer evidence and feedback from the workspace\n" +
      "3. Market research results from web searches\n" +
      "4. Technical context from the codebase (if available)\n\n" +
      "Provide a structured assessment:\n\n" +
      "## Verdict: [BUILD / MAYBE / SKIP]\n\n" +
      "## Customer Demand\n" +
      "**Rating: [Strong / Moderate / Weak]**\n" +
      "What evidence exists from actual customers? Quote or reference specific feedback.\n\n" +
      "## Market Validation\n" +
      "**Rating: [Proven / Emerging / Unproven]**\n" +
      "Is this a proven market need? Are competitors doing this? What do trends show?\n\n" +
      "## Technical Effort\n" +
      "**Rating: [Low / Medium / High]**\n" +
      "Based on the codebase context, how complex is this to build? What are the major technical risks?\n\n" +
      "## Recommendation\n" +
      "A clear 2-3 sentence recommendation with reasoning. If BUILD, what should be the MVP scope? If SKIP, what would change your mind?\n\n" +
      "Be honest and direct. Ground everything in the evidence provided.",
    contextStrategy: "market_feasibility",
    outputMode: "stream_with_insert",
  },
];

export function findMatchingAction(query: string): AIAction | null {
  const lower = query.toLowerCase().trim();
  for (const action of AI_ACTIONS) {
    if (
      action.label.toLowerCase() === lower ||
      lower.startsWith(action.label.toLowerCase().replace("...", "").trim())
    ) {
      return action;
    }
  }
  return null;
}
