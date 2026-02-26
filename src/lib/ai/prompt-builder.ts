import type { AIAction } from "./actions";

interface WorkspaceContext {
  name: string;
  productDescription: string | null;
  principles: string[];
}

interface DocumentContext {
  title: string;
  type: string;
  content: string; // Markdown serialization of the Tiptap doc
}

interface CodeModuleContext {
  filePath: string;
  summary: string;
  chunkText: string;
  moduleType?: string;
  rawContent?: string;
}

interface MarketResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

interface WorkspaceOverviewContext {
  clusters: { label: string; summary: string; count: number }[];
  allSpecs: { title: string; type: string; status: string }[];
  unlinkedEvidence: { title: string; content: string }[];
  totalEvidenceCount: number;
}

interface RetrievedContext {
  artifacts: { title: string; type: string; chunkText: string }[];
  evidence: {
    title: string;
    source: string;
    chunkText: string;
    tags: string[];
  }[];
  codebaseModules: CodeModuleContext[];
  architectureSummary?: string;
  marketResearch?: {
    competitors: MarketResult[];
    trends: MarketResult[];
    bestPractices: MarketResult[];
  };
  workspaceOverview?: WorkspaceOverviewContext;
}

const CODE_SPECIFIC_STRATEGIES = new Set([
  "doc_with_code",
  "all",
]);

export function buildPrompt(
  action: AIAction | null,
  currentDoc: DocumentContext,
  context: RetrievedContext,
  workspace: WorkspaceContext,
  userQuery: string,
  param?: string,
  concise?: boolean
): { system: string; user: string } {
  // --- System prompt: product context base ---
  const systemParts: string[] = [
    "You are an AI assistant embedded in Koso, an IDE for product managers.",
    "You help PMs write better specs, find conflicts, synthesize feedback, and think through edge cases.",
    "",
    `Workspace: ${workspace.name}`,
  ];

  if (workspace.productDescription) {
    systemParts.push(`Product: ${workspace.productDescription}`);
  }

  if (workspace.principles.length > 0) {
    systemParts.push("");
    systemParts.push("Product Principles:");
    for (const p of workspace.principles) {
      systemParts.push(`- ${p}`);
    }
  }

  systemParts.push("");
  systemParts.push(
    "Respond in clean, well-structured markdown. " +
      "Use ## for section headings, **bold** for emphasis, and - for bullet points. " +
      "Use numbered lists (1. 2. 3.) with correct sequential numbering. " +
      "Be specific and actionable. Never be vague or generic — ground everything in the actual document and context provided."
  );

  if (concise) {
    systemParts.push("");
    systemParts.push(
      "IMPORTANT: Give a brief, opinionated response. " +
        "Lead with your recommendation or key insight in 1-2 sentences. " +
        "Then provide at most 3-5 bullet points of supporting detail. " +
        "Total response should be under 150 words. " +
        "Be direct and skip preamble. The user can ask for more detail if needed."
    );
  }

  // --- User prompt ---
  const userParts: string[] = [];

  // Current document
  userParts.push(`## Current Document: ${currentDoc.title} (${currentDoc.type})`);
  userParts.push("");
  userParts.push(currentDoc.content);
  userParts.push("");

  // Architecture summary (always included when available)
  if (context.architectureSummary) {
    userParts.push("--- Codebase Architecture ---");
    userParts.push("");
    userParts.push(context.architectureSummary);
    userParts.push("");
  }

  // Retrieved context
  if (context.artifacts.length > 0) {
    userParts.push("--- Related Specifications ---");
    for (const a of context.artifacts) {
      userParts.push(`\n### ${a.title} (${a.type})`);
      userParts.push(a.chunkText);
    }
    userParts.push("");
  }

  if (context.evidence.length > 0) {
    userParts.push("--- Customer Evidence ---");
    for (const e of context.evidence) {
      userParts.push(
        `\n**${e.title}** (${e.source})${e.tags.length > 0 ? ` [${e.tags.join(", ")}]` : ""}`
      );
      userParts.push(e.chunkText);
    }
    userParts.push("");
  }

  // Code module summaries (top 5 for any action when available)
  if (context.codebaseModules.length > 0) {
    userParts.push("--- Relevant Code Modules ---");
    const summaryModules = context.codebaseModules.slice(0, 5);
    for (const c of summaryModules) {
      const typeLabel = c.moduleType ? ` [${c.moduleType}]` : "";
      userParts.push(`\n**${c.filePath}**${typeLabel}${c.summary ? ` — ${c.summary}` : ""}`);
      userParts.push(c.chunkText);
    }
    userParts.push("");

    // For code-specific actions, include full raw_content of top 3
    const strategy = action?.contextStrategy || "all";
    if (CODE_SPECIFIC_STRATEGIES.has(strategy)) {
      const modulesWithCode = context.codebaseModules
        .filter((c) => c.rawContent)
        .slice(0, 3);

      if (modulesWithCode.length > 0) {
        userParts.push("--- Full Source Code (Most Relevant) ---");
        for (const c of modulesWithCode) {
          userParts.push(`\n### ${c.filePath}`);
          userParts.push("```");
          userParts.push(c.rawContent!);
          userParts.push("```");
        }
        userParts.push("");
      }
    }
  }

  // Market research context
  if (context.marketResearch) {
    const { competitors, trends, bestPractices } = context.marketResearch;
    const hasMarket =
      competitors.length > 0 || trends.length > 0 || bestPractices.length > 0;

    if (hasMarket) {
      userParts.push("--- Market Research Results ---");
      userParts.push("");

      if (competitors.length > 0) {
        userParts.push("### Competitors");
        for (const r of competitors) {
          userParts.push(
            `- **${r.title}** (${r.source}): ${r.snippet}`
          );
        }
        userParts.push("");
      }

      if (trends.length > 0) {
        userParts.push("### Market Trends");
        for (const r of trends) {
          userParts.push(
            `- **${r.title}** (${r.source}): ${r.snippet}`
          );
        }
        userParts.push("");
      }

      if (bestPractices.length > 0) {
        userParts.push("### Best Practices");
        for (const r of bestPractices) {
          userParts.push(
            `- **${r.title}** (${r.source}): ${r.snippet}`
          );
        }
        userParts.push("");
      }
    }
  }

  // Workspace overview context
  if (context.workspaceOverview) {
    const wo = context.workspaceOverview;

    userParts.push("--- Workspace Overview ---");
    userParts.push("");
    userParts.push(
      `Total evidence: ${wo.totalEvidenceCount} items (${wo.unlinkedEvidence.length} unlinked to any spec)`
    );
    userParts.push("");

    if (wo.clusters.length > 0) {
      userParts.push("Evidence Clusters (pre-computed themes):");
      for (const c of wo.clusters) {
        userParts.push(`- ${c.label} (${c.count} items): ${c.summary}`);
      }
      userParts.push("");
    }

    if (wo.allSpecs.length > 0) {
      userParts.push("All Specifications:");
      for (const s of wo.allSpecs) {
        userParts.push(`- ${s.title} [${s.type}] — ${s.status}`);
      }
      userParts.push("");
    }

    if (wo.unlinkedEvidence.length > 0) {
      const capped = wo.unlinkedEvidence.slice(0, 30);
      userParts.push(
        `Unlinked Evidence (${wo.unlinkedEvidence.length} items, showing up to 30):`
      );
      for (const e of capped) {
        const snippet = e.content.slice(0, 200);
        userParts.push(`- ${e.title}: ${snippet}`);
      }
      userParts.push("");
    }
  }

  // The specific request
  userParts.push("---");
  userParts.push("");

  if (action) {
    let prompt = action.promptTemplate;
    if (param) {
      prompt = prompt.replace("{param}", param);
    }
    userParts.push(prompt);
  } else {
    userParts.push(userQuery);
  }

  return {
    system: systemParts.join("\n"),
    user: userParts.join("\n"),
  };
}
