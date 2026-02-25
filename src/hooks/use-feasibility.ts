"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { FeasibilityAssessment } from "@/types";

interface FeasibilityState {
  assessment: FeasibilityAssessment | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: FeasibilityState = {
  assessment: null,
  loading: false,
  error: null,
};

function simpleHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash;
}

function parseFeasibilityResponse(text: string): FeasibilityAssessment {
  const lines = text.split("\n");

  const affectedModules: string[] = [];
  let complexity: FeasibilityAssessment["complexity"] = {
    level: "Medium",
    reason: "",
  };
  const buildingBlocks: string[] = [];
  const risks: string[] = [];

  let currentSection = "";

  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    // Detect sections
    if (lower.includes("affected module") || lower.includes("affected file")) {
      currentSection = "modules";
      continue;
    }
    if (lower.includes("complexity")) {
      currentSection = "complexity";
      // Try to extract inline complexity
      if (lower.includes("high")) {
        complexity.level = "High";
      } else if (lower.includes("low")) {
        complexity.level = "Low";
      } else {
        complexity.level = "Medium";
      }
      // Extract reason after colon or dash
      const reasonMatch = trimmed.match(/(?:high|medium|low)[^a-z]*[-—:]\s*(.+)/i);
      if (reasonMatch) {
        complexity.reason = reasonMatch[1].trim();
      }
      continue;
    }
    if (lower.includes("building block") || lower.includes("existing code")) {
      currentSection = "blocks";
      continue;
    }
    if (lower.includes("risk")) {
      currentSection = "risks";
      continue;
    }

    // Skip empty lines and headers
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Parse list items
    const listItem = trimmed.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "");
    if (!listItem) continue;

    switch (currentSection) {
      case "modules":
        // Extract file paths (look for paths with slashes or dots)
        const pathMatch = listItem.match(
          /`?([a-zA-Z0-9_/.@-]+\.[a-zA-Z]+)`?/
        );
        if (pathMatch) {
          affectedModules.push(pathMatch[1]);
        } else if (listItem.includes("/")) {
          affectedModules.push(listItem.replace(/[`*]/g, "").trim());
        }
        break;
      case "complexity":
        if (!complexity.reason && listItem.length > 5) {
          complexity.reason = listItem.replace(/[`*]/g, "").trim();
        }
        break;
      case "blocks":
        buildingBlocks.push(listItem.replace(/[`*]/g, "").trim());
        break;
      case "risks":
        risks.push(listItem.replace(/[`*]/g, "").trim());
        break;
    }
  }

  return { affectedModules, complexity, buildingBlocks, risks };
}

export function useFeasibility(
  workspaceId: string,
  hasCodebase: boolean
) {
  const [state, setState] = useState<FeasibilityState>(EMPTY_STATE);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHashRef = useRef<number>(0);
  const cacheRef = useRef<Map<number, FeasibilityAssessment>>(new Map());

  const executeAssessment = useCallback(
    async (sectionText: string, docTitle: string, docType: string) => {
      if (!sectionText.trim() || !workspaceId || !hasCodebase) return;

      const hash = simpleHash(sectionText);
      if (hash === lastHashRef.current) return;
      lastHashRef.current = hash;

      const cached = cacheRef.current.get(hash);
      if (cached) {
        setState({ assessment: cached, loading: false, error: null });
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Fetch code context + architecture summary
        const searchRes = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: sectionText,
            workspaceId,
            grouped: true,
          }),
          signal: controller.signal,
        });

        if (!searchRes.ok) throw new Error("Search failed");
        const searchData = await searchRes.json();
        const codeModules = searchData.results.codebaseModules ?? [];

        // Build architecture context
        let archSummary = "";
        const archArtifacts = (searchData.results.artifacts ?? []).filter(
          (a: Record<string, unknown>) =>
            (a.metadata as Record<string, unknown>)?.type ===
            "architecture_summary"
        );
        if (archArtifacts.length > 0) {
          archSummary = archArtifacts[0].chunkText as string;
        }

        // Build code context string
        const codeContext = codeModules
          .slice(0, 5)
          .map((m: Record<string, unknown>) => {
            const meta = m.metadata as Record<string, unknown>;
            return `- ${meta?.file_path || "unknown"} [${meta?.module_type || "module"}]: ${meta?.summary || (m.chunkText as string)}`;
          })
          .join("\n");

        const systemPrompt =
          "You are a technical feasibility analyst. Given a product specification section and codebase context, " +
          "provide a brief, structured feasibility assessment. Be concise — each section should be 1-3 items max. " +
          "Respond ONLY with the structured sections below, no introduction or conclusion.";

        const userPrompt =
          `## Document: ${docTitle} (${docType})\n\n${sectionText}\n\n` +
          (archSummary
            ? `--- Codebase Architecture ---\n${archSummary}\n\n`
            : "") +
          (codeContext
            ? `--- Relevant Code Modules ---\n${codeContext}\n\n`
            : "") +
          "---\n\n" +
          "Provide a feasibility assessment with these exact sections:\n\n" +
          "## Affected Modules\n" +
          "List the specific file paths that would need changes.\n\n" +
          "## Complexity\n" +
          "State: Low, Medium, or High — followed by a one-line reason.\n\n" +
          "## Building Blocks\n" +
          "List existing code that can be leveraged.\n\n" +
          "## Risks\n" +
          "List potential technical issues or blockers.";

        // Use Haiku for speed — non-streaming, collect full response
        const aiRes = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: systemPrompt,
            user: userPrompt,
            model: "haiku",
          }),
          signal: controller.signal,
        });

        if (!aiRes.ok) throw new Error("AI request failed");

        // Read the SSE stream to collect full text
        const reader = aiRes.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) fullText += parsed.text;
              } catch {
                // skip parse errors
              }
            }
          }
        }

        const assessment = parseFeasibilityResponse(fullText);
        cacheRef.current.set(hash, assessment);
        setState({ assessment, loading: false, error: null });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[feasibility] Assessment error:", err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to generate assessment",
        }));
      }
    },
    [workspaceId, hasCodebase]
  );

  const triggerAssessment = useCallback(
    (sectionText: string, docTitle: string, docType: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => executeAssessment(sectionText, docTitle, docType),
        1500
      );
    },
    [executeAssessment]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { ...state, triggerAssessment };
}
