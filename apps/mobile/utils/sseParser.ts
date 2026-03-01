/**
 * SSE stream parser for AI chat responses.
 *
 * Parses a ReadableStream from fetch() response.body, splitting on
 * double-newline boundaries and extracting `data: ` prefixed chunks.
 */

interface SSECallbacks {
  onChunk: (content: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
  onStatus?: (status: string) => void;
  onMeta?: (meta: { conversationId: string }) => void;
}

function processSSELine(
  line: string,
  onChunk: (content: string) => void,
  onStatus?: (status: string) => void,
  onMeta?: (meta: { conversationId: string }) => void,
): boolean {
  if (!line.startsWith("data: ")) return false;
  const payload = line.slice(6);
  if (payload === "[DONE]") return true;
  try {
    const parsed = JSON.parse(payload);
    if (parsed.conversation_id) onMeta?.({ conversationId: parsed.conversation_id });
    else if (parsed.status) onStatus?.(parsed.status);
    else if (parsed.content) onChunk(parsed.content);
  } catch {
    // Skip malformed JSON chunks
  }
  return false;
}

export async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  { onChunk, onDone, onError, onStatus, onMeta }: SSECallbacks,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const isDone = processSSELine(part.trim(), onChunk, onStatus, onMeta);
        if (isDone) { onDone(); return; }
      }
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
  }
}
