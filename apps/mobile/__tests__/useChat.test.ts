/**
 * Unit tests for hooks/useChat — useChatStream waking_up state transitions.
 */

import { renderHook, act } from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Mocks (must come before hook import)
// ---------------------------------------------------------------------------

const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => ({ data: undefined, isLoading: false })),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  useMutation: jest.fn(),
}));

jest.mock("../services/api", () => ({
  api: {
    chatStream: jest.fn(),
    getConversations: jest.fn(),
    getConversation: jest.fn(),
    deleteConversation: jest.fn(),
  },
}));

jest.mock("../utils/sseParser", () => ({
  parseSSEStream: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks — get references to mocked functions
// ---------------------------------------------------------------------------

import { useChatStream } from "../hooks/useChat";

const { api } = require("../services/api") as {
  api: { chatStream: jest.Mock };
};
const { parseSSEStream } = require("../utils/sseParser") as {
  parseSSEStream: jest.Mock;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock Response with ok/status/body/json. */
function mockResponse(ok: boolean, status = 200): Response {
  return {
    ok,
    status,
    body: new ReadableStream(),
    json: jest.fn().mockResolvedValue({}),
  } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useChatStream", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() => useChatStream());

    expect(result.current.streamingState).toBe("idle");
    expect(result.current.streamingContent).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("calls api.chatStream with correct payload", async () => {
    api.chatStream.mockResolvedValue(mockResponse(true));
    parseSSEStream.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage(
        [{ role: "user", content: "hello" }],
        "conv-1",
        "hive-2",
      );
    });

    expect(api.chatStream).toHaveBeenCalledWith({
      messages: [{ role: "user", content: "hello" }],
      conversationId: "conv-1",
      hiveId: "hive-2",
    });
  });

  it("sets waking_up state when onStatus fires", async () => {
    api.chatStream.mockResolvedValue(mockResponse(true));

    parseSSEStream.mockImplementation(
      async (_body: unknown, callbacks: { onStatus: (s: string) => void }) => {
        callbacks.onStatus("waking_up");
      },
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage([{ role: "user", content: "hi" }]);
    });

    expect(result.current.streamingState).toBe("waking_up");
  });

  it("accumulates streaming content from onChunk callbacks", async () => {
    api.chatStream.mockResolvedValue(mockResponse(true));

    parseSSEStream.mockImplementation(
      async (_body: unknown, callbacks: { onChunk: (c: string) => void; onDone: () => void }) => {
        callbacks.onChunk("Hello");
        callbacks.onChunk(" world");
        callbacks.onDone();
      },
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage([{ role: "user", content: "hi" }]);
    });

    expect(result.current.streamingState).toBe("idle");
    expect(result.current.streamingContent).toBe("Hello world");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["conversations"],
    });
  });

  it("sets error state when API returns non-ok response", async () => {
    api.chatStream.mockResolvedValue(mockResponse(false, 500));

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage([{ role: "user", content: "hi" }]);
    });

    expect(result.current.streamingState).toBe("error");
    expect(result.current.error).toBeTruthy();
  });

  it("sets error state when onError callback fires", async () => {
    api.chatStream.mockResolvedValue(mockResponse(true));

    parseSSEStream.mockImplementation(
      async (_body: unknown, callbacks: { onError: (e: Error) => void }) => {
        callbacks.onError(new Error("stream broke"));
      },
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage([{ role: "user", content: "hi" }]);
    });

    expect(result.current.streamingState).toBe("error");
    expect(result.current.error?.message).toBe("stream broke");
  });

  it("reset clears all state back to idle", async () => {
    api.chatStream.mockResolvedValue(mockResponse(true));

    parseSSEStream.mockImplementation(
      async (_body: unknown, callbacks: { onChunk: (c: string) => void; onDone: () => void }) => {
        callbacks.onChunk("content");
        callbacks.onDone();
      },
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage([{ role: "user", content: "hi" }]);
    });

    expect(result.current.streamingContent).toBe("content");

    act(() => {
      result.current.reset();
    });

    expect(result.current.streamingState).toBe("idle");
    expect(result.current.streamingContent).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("falls back to text parsing when response has no body", async () => {
    const resp = {
      ok: true,
      status: 200,
      body: null,
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue(""),
    } as unknown as Response;
    api.chatStream.mockResolvedValue(resp);

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage([{ role: "user", content: "hi" }]);
    });

    // With the response fallback, parseViaText runs and completes normally
    expect(result.current.streamingState).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("captures conversationId from onMeta callback", async () => {
    api.chatStream.mockResolvedValue(mockResponse(true));

    parseSSEStream.mockImplementation(
      async (
        _body: unknown,
        callbacks: {
          onChunk: (c: string) => void;
          onMeta: (m: { conversationId: string }) => void;
          onDone: () => void;
        },
      ) => {
        callbacks.onChunk("Hi");
        callbacks.onMeta({ conversationId: "conv-new-123" });
        callbacks.onDone();
      },
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage([{ role: "user", content: "hello" }]);
    });

    expect(result.current.conversationId).toBe("conv-new-123");
    expect(result.current.streamingContent).toBe("Hi");
  });

  it("full cold-start flow: waking_up then content then idle", async () => {
    api.chatStream.mockResolvedValue(mockResponse(true));

    parseSSEStream.mockImplementation(
      async (
        _body: unknown,
        callbacks: { onChunk: (c: string) => void; onStatus: (s: string) => void; onDone: () => void },
      ) => {
        callbacks.onStatus("waking_up");
        callbacks.onChunk("Answer");
        callbacks.onDone();
      },
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage([{ role: "user", content: "hi" }]);
    });

    expect(result.current.streamingState).toBe("idle");
    expect(result.current.streamingContent).toBe("Answer");
  });
});
