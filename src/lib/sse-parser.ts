/**
 * Parse an SSE (Server-Sent Events) stream from a fetch Response.
 *
 * Returns `true` if the stream completed without errors, `false` otherwise.
 */
export async function parseSSEStream(
  response: Response,
  callbacks: {
    onStep?: (step: string) => void;
    onError?: (error: string) => void;
  }
): Promise<boolean> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/event-stream") || !response.body) {
    return true;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let hadError = false;

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
          if (parsed.step) callbacks.onStep?.(parsed.step);
          if (parsed.error) {
            hadError = true;
            callbacks.onError?.(parsed.error);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  return !hadError;
}
