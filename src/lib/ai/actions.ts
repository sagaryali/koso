export type ContextStrategy =
  | "full_doc"
  | "full_doc_with_specs"
  | "evidence_search"
  | "evidence_with_specs"
  | "doc_with_code"
  | "market_research"
  | "market_competitors"
  | "market_feasibility"
  | "workspace_overview"
  | "cascading"
  | "all";

export type OutputMode =
  | "stream"
  | "stream_with_insert"
  | "stream_with_artifacts"
  | "stream_with_checklist";

export type SectionRelevance = "evidence_first" | "code_first" | "balanced" | "all";

export interface AIAction {
  id: string;
  label: string;
  description: string;
  promptTemplate: string;
  contextStrategy: ContextStrategy;
  outputMode: OutputMode;
  sectionRelevance?: SectionRelevance[];
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
    sectionRelevance: ["evidence_first"],
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
    sectionRelevance: ["code_first", "balanced"],
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
    sectionRelevance: ["code_first"],
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
    sectionRelevance: ["code_first"],
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

  // --- Section Draft Action ---

  {
    id: "draft_section",
    label: "Draft this section",
    description:
      "Generate content for the current section using prior sections as cascading context",
    promptTemplate:
      "Draft the content for this section, building on everything that came before it in the spec.",
    contextStrategy: "cascading",
    outputMode: "stream_with_insert",
    sectionRelevance: ["evidence_first", "code_first", "balanced"],
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

  // --- Thinking Partner Actions (Spec-level) ---

  {
    id: "whos_asking",
    label: "Who's asking for this?",
    description:
      "Surface all related customer evidence, segment requestors, and identify urgency signals",
    sectionRelevance: ["evidence_first"],
    promptTemplate:
      "Based on the specification and all customer evidence provided, answer: who is asking for this feature?\n\n" +
      "Provide:\n" +
      "1. Customer segments - Group the requestors by persona, company size, plan tier, or other relevant segments\n" +
      "2. Urgency signals - Which requests mention deadlines, blockers, or churn risk? Quote specific language\n" +
      "3. Request frequency - How many distinct customers or pieces of evidence mention this need?\n" +
      "4. Key quotes - The most compelling 3-5 direct quotes that capture the demand\n" +
      "5. Gaps - Are there segments you'd expect to want this but haven't heard from?\n\n" +
      "Ground every observation in the actual evidence provided. Do not invent feedback.",
    contextStrategy: "evidence_search",
    outputMode: "stream",
  },
  {
    id: "challenge_spec",
    label: "Challenge this spec",
    description:
      "Critical review: unstated assumptions, evidence gaps, conflicts, and missing edge cases",
    promptTemplate:
      "Act as a senior PM and engineering lead reviewing this spec before it goes to development. Be direct and constructive.\n\n" +
      "Provide a critical review covering:\n" +
      "1. Unstated assumptions - What is this spec assuming that hasn't been validated? What could go wrong if those assumptions are false?\n" +
      "2. Evidence gaps - What claims lack supporting customer evidence? Where is the spec speculating rather than building on data?\n" +
      "3. Conflicts with other specs - Does this overlap, contradict, or create dependencies with existing specifications?\n" +
      "4. Missing edge cases - What scenarios hasn't the author considered? What happens when things go wrong?\n" +
      "5. Scope concerns - Is this trying to do too much? Too little? What would you cut or add?\n" +
      "6. Success criteria - Are the success metrics clear, measurable, and actually tied to the stated goals?\n\n" +
      "For each issue, rate its severity (HIGH / MEDIUM / LOW) and suggest how to address it.\n" +
      "Be the pushback the PM needs before engineering starts building.",
    contextStrategy: "evidence_with_specs",
    outputMode: "stream",
  },
  {
    id: "build_the_case",
    label: "Build the case for this",
    description:
      "Compile a stakeholder-ready business case from evidence, market data, and strategic alignment",
    promptTemplate:
      "You are given a product specification, customer evidence, and market research.\n\n" +
      "Compile a stakeholder-ready business case for this feature:\n\n" +
      "1. Problem statement - What customer pain are we solving? Use evidence to quantify the impact\n" +
      "2. Customer demand - How many customers are asking? What segments? Quote the strongest signals\n" +
      "3. Market context - What are competitors doing? Is this table stakes or a differentiator?\n" +
      "4. Strategic alignment - How does this fit the product's principles and direction?\n" +
      "5. Risk of inaction - What happens if we don't build this? Churn risk, competitive disadvantage, opportunity cost\n" +
      "6. Recommended scope - What's the minimum viable version that captures most of the value?\n\n" +
      "Write this so a PM can present it directly to leadership. Be persuasive but honest — flag any weaknesses in the case.",
    contextStrategy: "market_feasibility",
    outputMode: "stream_with_insert",
  },
  {
    id: "whats_missing",
    label: "What's missing from this?",
    description:
      "Gap analysis: uncovered customer requests, missing patterns, and overlooked requirements",
    promptTemplate:
      "Compare this specification against the customer evidence and related specifications provided. Identify what's missing.\n\n" +
      "Provide:\n" +
      "1. Uncovered customer requests - Evidence items that mention needs this spec doesn't address\n" +
      "2. Missing patterns - Requirements that peer specs include but this one lacks (error handling, accessibility, analytics, etc.)\n" +
      "3. Unaddressed personas - User types mentioned in evidence who aren't served by this spec\n" +
      "4. Integration gaps - Connections to other features or specs that should be mentioned\n" +
      "5. Acceptance criteria gaps - Scenarios that need criteria but don't have them\n\n" +
      "For each gap, explain why it matters and suggest how to address it.\n" +
      "Focus on substantive gaps, not formatting nitpicks.",
    contextStrategy: "evidence_with_specs",
    outputMode: "stream",
  },

  // --- Thinking Partner Actions (Workspace-level) ---

  {
    id: "what_to_build_next",
    label: "What should we build next?",
    description:
      "Portfolio-level prioritization using evidence themes, spec coverage, and product principles",
    promptTemplate:
      "You are given a workspace overview including all evidence clusters (pre-computed themes), all specification titles and statuses, and product principles.\n\n" +
      "Provide a prioritized recommendation of what to build next:\n\n" +
      "1. Top 3 opportunities - The highest-impact themes from evidence clusters that either have no spec coverage or inadequate spec coverage. For each:\n" +
      "   - Theme and evidence volume\n" +
      "   - Whether existing specs address it (and gaps if they do)\n" +
      "   - Alignment with product principles\n" +
      "   - Suggested scope for a first spec\n\n" +
      "2. Existing specs to prioritize - Among specs already written, which should ship first based on evidence demand?\n\n" +
      "3. Deprioritize - Any specs that lack evidence support and could be deferred\n\n" +
      "Be opinionated. Rank by impact, not effort. Ground everything in the evidence and principles provided.",
    contextStrategy: "workspace_overview",
    outputMode: "stream",
  },
  {
    id: "customer_struggles",
    label: "What are customers struggling with?",
    description:
      "Synthesize all evidence into ranked pain points with severity and spec coverage",
    promptTemplate:
      "You are given a workspace overview including all evidence clusters, all specifications, and unlinked evidence.\n\n" +
      "Synthesize a pain point report:\n\n" +
      "1. Top pain points - Ranked by severity and frequency. For each:\n" +
      "   - Pain point description\n" +
      "   - Evidence volume (how many pieces of evidence mention this)\n" +
      "   - Severity (blocking, frustrating, or minor)\n" +
      "   - Addressed by spec? (which spec addresses it, if any, and how completely)\n\n" +
      "2. Emerging patterns - Pain points with only 2-3 mentions that could grow into major themes\n\n" +
      "3. Positive signals - What are customers happy about? What's working well?\n\n" +
      "Ground every point in the actual evidence provided. Include specific examples where possible.",
    contextStrategy: "workspace_overview",
    outputMode: "stream",
  },
  {
    id: "unaddressed_feedback",
    label: "What feedback haven't we addressed?",
    description:
      "Find evidence not connected to any spec, group into themes, and suggest what could become new specs",
    promptTemplate:
      "You are given a workspace overview including evidence clusters and all current specifications.\n\n" +
      "Analyze the feedback that hasn't been addressed in specs:\n\n" +
      "1. Unaddressed evidence themes - Group evidence that has no matching spec into themes. For each theme:\n" +
      "   - Theme name and description\n" +
      "   - Number of evidence items\n" +
      "   - Representative examples (quote 2-3 specific items)\n" +
      "   - Should this become a new spec? Why or why not?\n\n" +
      "2. Coverage gaps - Evidence themes that exist in clusters but have no matching spec\n\n" +
      "3. Recommended new specs - Your top 3 suggestions for new specifications based on unaddressed feedback, with a one-sentence scope for each\n\n" +
      "Help the PM ensure nothing falls through the cracks.",
    contextStrategy: "workspace_overview",
    outputMode: "stream",
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

/**
 * Get the most relevant actions for a given section context strategy.
 * Returns up to `limit` actions, with "Draft this section" always first.
 */
export function getActionsForSection(
  contextStrategy: SectionRelevance,
  limit: number = 5
): AIAction[] {
  const results: AIAction[] = [];

  // Always include "Draft this section" first
  const draftAction = AI_ACTIONS.find((a) => a.id === "draft_section");
  if (draftAction) results.push(draftAction);

  // Filter actions relevant to this section's context strategy
  const relevant = AI_ACTIONS.filter(
    (a) =>
      a.id !== "draft_section" &&
      a.contextStrategy !== "workspace_overview" &&
      a.sectionRelevance?.includes(contextStrategy)
  );

  results.push(...relevant);

  // Fill remaining slots with general actions
  if (results.length < limit) {
    const general = AI_ACTIONS.filter(
      (a) =>
        !results.includes(a) &&
        a.contextStrategy !== "workspace_overview" &&
        a.contextStrategy !== "market_research" &&
        a.contextStrategy !== "market_competitors"
    );
    results.push(...general.slice(0, limit - results.length));
  }

  return results.slice(0, limit);
}
