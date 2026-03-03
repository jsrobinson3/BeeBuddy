/**
 * SSE stream parser for AI chat responses.
 *
 * Parses a ReadableStream from fetch() response.body, splitting on
 * double-newline boundaries and extracting `data: ` prefixed chunks.
 * Falls back to response.text() on platforms without ReadableStream.
 */

interface SSECallbacks {
  onChunk: (content: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
  onStatus?: (status: string) => void;
  onMeta?: (meta: { conversationId: string }) => void;
  onPendingAction?: (action: {
    id: string;
    actionType: string;
    resourceType: string;
    summary: string;
    payload: Record<string, unknown>;
    expiresAt: string;
  }) => void;
  onServerError?: (error: { error: string; message: string }) => void;
}

function processSSELine(
  line: string,
  onChunk: (content: string) => void,
  onStatus?: (status: string) => void,
  onMeta?: (meta: { conversationId: string }) => void,
  onPendingAction?: SSECallbacks["onPendingAction"],
  onServerError?: SSECallbacks["onServerError"],
): boolean {
  if (!line.startsWith("data: ")) return false;
  const payload = line.slice(6);
  if (payload === "[DONE]") return true;
  try {
    const parsed = JSON.parse(payload);
    if (parsed.error && parsed.message) onServerError?.({ error: parsed.error, message: parsed.message });
    else if (parsed.pending_action) onPendingAction?.(parsed.pending_action);
    else if (parsed.conversation_id) onMeta?.({ conversationId: parsed.conversation_id });
    else if (parsed.status) onStatus?.(parsed.status);
    else if (parsed.content) onChunk(parsed.content);
  } catch {
    // Skip malformed JSON chunks
  }
  return false;
}

/** Process an array of SSE parts, returning true if [DONE] was found. */
function processParts(
  parts: string[],
  onChunk: (content: string) => void,
  onStatus?: (status: string) => void,
  onMeta?: (meta: { conversationId: string }) => void,
  onPendingAction?: SSECallbacks["onPendingAction"],
  onServerError?: SSECallbacks["onServerError"],
): boolean {
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed && processSSELine(trimmed, onChunk, onStatus, onMeta, onPendingAction, onServerError)) return true;
  }
  return false;
}

async function parseViaStream(
  body: ReadableStream<Uint8Array>,
  { onChunk, onDone, onError, onStatus, onMeta, onPendingAction, onServerError }: SSECallbacks,
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

      if (processParts(parts, onChunk, onStatus, onMeta, onPendingAction, onServerError)) { onDone(); return; }
    }
    if (buffer.trim()) processSSELine(buffer.trim(), onChunk, onStatus, onMeta, onPendingAction, onServerError);
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
  }
}

async function parseViaText(
  response: Response,
  { onChunk, onDone, onError, onStatus, onMeta, onPendingAction, onServerError }: SSECallbacks,
): Promise<void> {
  try {
    const text = await response.text();
    const parts = text.split("\n\n");
    processParts(parts, onChunk, onStatus, onMeta, onPendingAction, onServerError);
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function parseSSEStream(
  body: ReadableStream<Uint8Array> | null,
  callbacks: SSECallbacks,
  response?: Response,
): Promise<void> {
  if (body && typeof body.getReader === "function") {
    return parseViaStream(body, callbacks);
  }
  if (response) {
    return parseViaText(response, callbacks);
  }
  callbacks.onError(new Error("No response body or fallback available"));
}
