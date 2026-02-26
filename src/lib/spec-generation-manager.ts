/**
 * Singleton manager that owns spec generation fetches independently of React component lifecycle.
 * When the user navigates away, the fetch continues running in the background.
 */

type SectionEvent =
  | { type: "section_start"; section: string }
  | { type: "delta"; section: string; text: string }
  | { type: "section_complete"; section: string; text: string }
  | { type: "done"; sections: { section: string; text: string }[] }
  | { type: "error"; message: string };

type Subscriber = (event: SectionEvent) => void;

interface ActiveGeneration {
  sections: { section: string; text: string }[];
  currentSection: string | null;
  currentText: string;
  done: boolean;
  error: string | null;
  subscribers: Set<Subscriber>;
}

const activeGenerations = new Map<string, ActiveGeneration>();

export function isGenerating(artifactId: string): boolean {
  const gen = activeGenerations.get(artifactId);
  return gen != null && !gen.done;
}

export function getProgress(artifactId: string): {
  sections: { section: string; text: string }[];
  currentSection: string | null;
  currentText: string;
  done: boolean;
  error: string | null;
} | null {
  const gen = activeGenerations.get(artifactId);
  if (!gen) return null;
  return {
    sections: gen.sections,
    currentSection: gen.currentSection,
    currentText: gen.currentText,
    done: gen.done,
    error: gen.error,
  };
}

export function subscribe(artifactId: string, callback: Subscriber): void {
  const gen = activeGenerations.get(artifactId);
  if (gen) gen.subscribers.add(callback);
}

export function unsubscribe(artifactId: string, callback: Subscriber): void {
  const gen = activeGenerations.get(artifactId);
  if (gen) gen.subscribers.delete(callback);
}

function notify(gen: ActiveGeneration, event: SectionEvent) {
  for (const sub of gen.subscribers) {
    try {
      sub(event);
    } catch {
      // subscriber error should not break the stream
    }
  }
}

export function startGeneration(
  artifactId: string,
  context: Record<string, unknown>,
  cachedSections: { section: string; text: string }[] = []
): void {
  // Already running — don't start another
  if (activeGenerations.has(artifactId)) return;

  const gen: ActiveGeneration = {
    sections: [...cachedSections],
    currentSection: null,
    currentText: "",
    done: false,
    error: null,
    subscribers: new Set(),
  };
  activeGenerations.set(artifactId, gen);

  const progressKey = `koso_draft_spec_progress_${artifactId}`;
  const contextKey = `koso_draft_spec_context_${artifactId}`;

  (async () => {
    try {
      const res = await fetch("/api/ai/draft-structured-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...context,
          completedSections: cachedSections.length > 0 ? cachedSections : undefined,
        }),
      });

      if (!res.ok) {
        gen.error = "Spec generation request failed.";
        gen.done = true;
        notify(gen, { type: "error", message: gen.error });
        activeGenerations.delete(artifactId);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        gen.error = "No response body from generation API.";
        gen.done = true;
        notify(gen, { type: "error", message: gen.error });
        activeGenerations.delete(artifactId);
        return;
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "section_start") {
                gen.currentSection = parsed.section;
                gen.currentText = "";
                notify(gen, { type: "section_start", section: parsed.section });
              } else if (parsed.type === "delta") {
                gen.currentText += parsed.text;
                notify(gen, { type: "delta", section: parsed.section, text: parsed.text });
              } else if (parsed.type === "section_complete") {
                gen.sections.push({ section: parsed.section, text: parsed.text });
                gen.currentSection = null;
                gen.currentText = "";
                sessionStorage.setItem(progressKey, JSON.stringify(gen.sections));
                notify(gen, { type: "section_complete", section: parsed.section, text: parsed.text });
              } else if (parsed.section && parsed.text && !parsed.type) {
                // Backward compat
                gen.sections.push({ section: parsed.section, text: parsed.text });
                gen.currentSection = null;
                gen.currentText = "";
                sessionStorage.setItem(progressKey, JSON.stringify(gen.sections));
                notify(gen, { type: "section_complete", section: parsed.section, text: parsed.text });
              }

              if (parsed.error) {
                gen.error = parsed.error;
                gen.done = true;
                notify(gen, { type: "error", message: parsed.error });
                activeGenerations.delete(artifactId);
                return;
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      // Done
      gen.done = true;
      sessionStorage.removeItem(contextKey);
      sessionStorage.removeItem(progressKey);
      notify(gen, { type: "done", sections: gen.sections });
      activeGenerations.delete(artifactId);
    } catch (err) {
      gen.error = "Spec generation failed.";
      gen.done = true;
      notify(gen, { type: "error", message: gen.error });
      activeGenerations.delete(artifactId);
    }
  })();
}
