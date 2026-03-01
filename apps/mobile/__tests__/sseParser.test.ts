/**
 * Unit tests for utils/sseParser — SSE stream parsing with status events.
 */

import { parseSSEStream } from "../utils/sseParser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a ReadableStream from an array of string chunks. */
function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i++;
      } else {
        controller.close();
      }
    },
  });
}

/** Build a properly formatted SSE event string. */
function sseEvent(data: Record<string, unknown> | string): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return `data: ${payload}\n\n`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseSSEStream", () => {
  it("parses content chunks and calls onDone", async () => {
    const stream = makeStream([
      sseEvent({ content: "Hello" }),
      sseEvent({ content: " world" }),
      sseEvent("[DONE]"),
    ]);

    const chunks: string[] = [];
    const onChunk = jest.fn((c: string) => chunks.push(c));
    const onDone = jest.fn();
    const onError = jest.fn();

    await parseSSEStream(stream, { onChunk, onDone, onError });

    expect(chunks).toEqual(["Hello", " world"]);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onStatus for status events", async () => {
    const stream = makeStream([
      sseEvent({ status: "waking_up" }),
      sseEvent({ content: "Hi" }),
      sseEvent("[DONE]"),
    ]);

    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();
    const onStatus = jest.fn();

    await parseSSEStream(stream, { onChunk, onDone, onError, onStatus });

    expect(onStatus).toHaveBeenCalledWith("waking_up");
    expect(onChunk).toHaveBeenCalledWith("Hi");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("does not crash when onStatus is not provided", async () => {
    const stream = makeStream([
      sseEvent({ status: "waking_up" }),
      sseEvent({ content: "OK" }),
      sseEvent("[DONE]"),
    ]);

    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await parseSSEStream(stream, { onChunk, onDone, onError });

    expect(onChunk).toHaveBeenCalledWith("OK");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("handles stream ending without [DONE]", async () => {
    const stream = makeStream([
      sseEvent({ content: "partial" }),
      // Stream ends without [DONE]
    ]);

    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await parseSSEStream(stream, { onChunk, onDone, onError });

    expect(onChunk).toHaveBeenCalledWith("partial");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("skips malformed JSON chunks", async () => {
    const stream = makeStream([
      "data: {invalid json}\n\n",
      sseEvent({ content: "valid" }),
      sseEvent("[DONE]"),
    ]);

    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await parseSSEStream(stream, { onChunk, onDone, onError });

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith("valid");
  });

  it("handles chunks split across stream reads", async () => {
    // Simulate a chunk boundary in the middle of an SSE event
    const full = sseEvent({ content: "split" });
    const half1 = full.slice(0, 10);
    const half2 = full.slice(10) + sseEvent("[DONE]");

    const stream = makeStream([half1, half2]);

    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await parseSSEStream(stream, { onChunk, onDone, onError });

    expect(onChunk).toHaveBeenCalledWith("split");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("calls onError when the stream throws", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("network failure"));
      },
    });

    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await parseSSEStream(stream, { onChunk, onDone, onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect((onError.mock.calls[0][0] as Error).message).toBe("network failure");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("handles multiple status events", async () => {
    const stream = makeStream([
      sseEvent({ status: "waking_up" }),
      sseEvent({ status: "processing" }),
      sseEvent({ content: "result" }),
      sseEvent("[DONE]"),
    ]);

    const onStatus = jest.fn();
    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await parseSSEStream(stream, { onChunk, onDone, onError, onStatus });

    expect(onStatus).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenNthCalledWith(1, "waking_up");
    expect(onStatus).toHaveBeenNthCalledWith(2, "processing");
  });

  it("calls onMeta with conversation_id from stream", async () => {
    const stream = makeStream([
      sseEvent({ content: "Hi" }),
      sseEvent({ conversation_id: "conv-abc-123" }),
      sseEvent("[DONE]"),
    ]);

    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();
    const onMeta = jest.fn();

    await parseSSEStream(stream, { onChunk, onDone, onError, onMeta });

    expect(onMeta).toHaveBeenCalledWith({ conversationId: "conv-abc-123" });
    expect(onChunk).toHaveBeenCalledWith("Hi");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("does not crash when onMeta is not provided", async () => {
    const stream = makeStream([
      sseEvent({ conversation_id: "conv-abc" }),
      sseEvent("[DONE]"),
    ]);

    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await parseSSEStream(stream, { onChunk, onDone, onError });

    expect(onChunk).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("ignores lines without data: prefix", async () => {
    const stream = makeStream([
      "event: ping\n\n",
      ": comment\n\n",
      sseEvent({ content: "real" }),
      sseEvent("[DONE]"),
    ]);

    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await parseSSEStream(stream, { onChunk, onDone, onError });

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith("real");
  });
});
