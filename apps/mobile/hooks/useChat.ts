import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../services/api";
import type { ChatMessage } from "../services/api";
import { parseSSEStream } from "../utils/sseParser";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
  });
}

export function useConversation(id?: string) {
  return useQuery({
    queryKey: ["conversations", id],
    queryFn: () => api.getConversation(id!),
    enabled: !!id,
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

type StreamingState = "idle" | "streaming" | "waking_up" | "fetching_data" | "error";

interface StreamHandlers {
  setContent: React.Dispatch<React.SetStateAction<string>>;
  setState: React.Dispatch<React.SetStateAction<StreamingState>>;
  setError: React.Dispatch<React.SetStateAction<Error | null>>;
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  onComplete: () => void;
}

async function fetchAndStream(
  messages: ChatMessage[],
  conversationId: string | undefined,
  hiveId: string | undefined,
  handlers: StreamHandlers,
): Promise<void> {
  const response = await api.chatStream({
    messages,
    conversationId: conversationId,
    hiveId,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${response.status}`);
  }
  if (!response.body) throw new Error("No response body");

  await parseSSEStream(response.body, {
    onChunk: (content) => handlers.setContent((prev) => prev + content),
    onStatus: (status) => {
      if (status === "waking_up") handlers.setState("waking_up");
      if (status === "fetching_data") handlers.setState("fetching_data");
    },
    onMeta: (meta) => handlers.setConversationId(meta.conversationId),
    onDone: () => { handlers.setState("idle"); handlers.onComplete(); },
    onError: (err) => { handlers.setError(err); handlers.setState("error"); },
  });
}

export function useChatStream() {
  const queryClient = useQueryClient();
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingState, setStreamingState] = useState<StreamingState>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handlers: StreamHandlers = {
    setContent: setStreamingContent,
    setState: setStreamingState,
    setError,
    setConversationId,
    onComplete: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  };

  const sendMessage = useCallback(
    async (messages: ChatMessage[], convId?: string, hiveId?: string) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setStreamingContent("");
      setStreamingState("streaming");
      setError(null);

      try {
        await fetchAndStream(messages, convId, hiveId, handlers);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setStreamingState("error");
      }
    },
    [queryClient],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStreamingContent("");
    setStreamingState("idle");
    setError(null);
  }, []);

  return { sendMessage, streamingContent, streamingState, error, reset, conversationId };
}
