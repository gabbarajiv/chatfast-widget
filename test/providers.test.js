import { describe, expect, it, vi, afterEach } from "vitest";
import { getProvider } from "../src/providers/index.js";
import { ollamaProvider } from "../src/providers/ollama.js";
import { openaiCompatibleProvider } from "../src/providers/openai-compatible.js";
import { readNdjsonStream } from "../src/providers/stream.js";
import { mockFetch, ndjsonBody, sseBody } from "./helpers/fetch-mock.js";

const baseConfig = {
  baseUrl: "http://localhost:11434/",
  model: "test-model",
  mode: "chat",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getProvider", () => {
  it("returns known providers", () => {
    expect(getProvider("ollama")).toBe(ollamaProvider);
    expect(getProvider("openai-compatible")).toBe(openaiCompatibleProvider);
  });

  it("throws for unknown provider", () => {
    expect(() => getProvider("nope")).toThrow("Unknown provider: nope");
  });
});

describe("readNdjsonStream", () => {
  it("emits trimmed lines and tail", async () => {
    const lines = [];
    const body = ndjsonBody(['{"a":1}', '{"b":2}']);
    await readNdjsonStream(body, (line) => lines.push(line));
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("skips blank lines and empty tail", async () => {
    const lines = [];
    const body = ndjsonBody(["", "  ", '{"ok":true}']);
    await readNdjsonStream(body, (line) => lines.push(line));
    expect(lines).toEqual(['{"ok":true}']);
  });

  it("handles chunked input", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"x":'));
        controller.enqueue(encoder.encode('1}\n'));
        controller.close();
      },
    });
    const lines = [];
    await readNdjsonStream(body, (line) => lines.push(line));
    expect(lines).toEqual(['{"x":1}']);
  });
});

describe("ollamaProvider", () => {
  it("listModels normalizes base and uses api key", async () => {
    mockFetch({
      "/api/tags": new Response(
        JSON.stringify({ models: [{ name: "a" }, { name: "" }] }),
        { status: 200 }
      ),
    });
    const models = await ollamaProvider.listModels("http://host/", "key");
    expect(models).toEqual(["a"]);
    expect(fetch).toHaveBeenCalledWith(
      "http://host/api/tags",
      expect.objectContaining({
        headers: { Authorization: "Bearer key" },
      })
    );
  });

  it("listModels throws on error", async () => {
    mockFetch({ "/api/tags": new Response("", { status: 500 }) });
    await expect(ollamaProvider.listModels("http://h")).rejects.toThrow(
      "Ollama list models failed (500)"
    );
  });

  it("send chat non-streaming", async () => {
    mockFetch({
      "/api/chat": new Response(
        JSON.stringify({ message: { content: "Hi" } }),
        { status: 200 }
      ),
    });
    const text = await ollamaProvider.send(baseConfig, [
      { role: "user", content: "Hello" },
    ]);
    expect(text).toBe("Hi");
  });

  it("send chat includes base64 images on user messages", async () => {
    mockFetch({
      "/api/chat": new Response(
        JSON.stringify({ message: { content: "Seen" } }),
        { status: 200 }
      ),
    });
    await ollamaProvider.send(baseConfig, [
      {
        role: "user",
        content: "What is this?",
        images: [{ mimeType: "image/png", data: "abc123" }],
      },
    ]);
    const init = /** @type {RequestInit} */ (fetch.mock.calls[0][1]);
    const body = JSON.parse(String(init.body));
    expect(body.messages).toEqual([
      {
        role: "user",
        content: "What is this?",
        images: ["abc123"],
      },
    ]);
  });

  it("send chat streaming skips bad json lines", async () => {
    mockFetch({
      "/api/chat": new Response(
        ndjsonBody(['not-json', '{"message":{"content":"A"}}']),
        { status: 200 }
      ),
    });
    const chunks = [];
    const text = await ollamaProvider.send(
      { ...baseConfig, systemPrompt: "sys" },
      [
        { role: "system", content: "ignored" },
        { role: "user", content: "Hello" },
      ],
      (c) => chunks.push(c)
    );
    expect(chunks).toEqual(["A"]);
    expect(text).toBe("A");
  });

  it("send chat errors include body text", async () => {
    mockFetch({
      "/api/chat": new Response("err", { status: 400 }),
    });
    await expect(
      ollamaProvider.send(baseConfig, [{ role: "user", content: "x" }])
    ).rejects.toThrow("Ollama chat failed (400): err");
  });

  it("send generate completions mode non-stream", async () => {
    mockFetch({
      "/api/generate": new Response(JSON.stringify({ response: "Done" }), {
        status: 200,
      }),
    });
    const text = await ollamaProvider.send(
      { ...baseConfig, mode: "completions" },
      [
        { role: "user", content: "One" },
        { role: "assistant", content: "Two" },
        { role: "user", content: "Three" },
      ]
    );
    expect(text).toBe("Done");
  });

  it("send generate streaming and single-user prompt", async () => {
    mockFetch({
      "/api/generate": new Response(
        ndjsonBody(['{"response":"X"}']),
        { status: 200 }
      ),
    });
    const text = await ollamaProvider.send(
      { ...baseConfig, mode: "completions" },
      [{ role: "user", content: "Only" }],
      () => {}
    );
    expect(text).toBe("X");
  });

  it("send generate errors", async () => {
    mockFetch({
      "/api/generate": new Response("", { status: 502 }),
    });
    await expect(
      ollamaProvider.send(
        { ...baseConfig, mode: "completions" },
        [{ role: "user", content: "x" }]
      )
    ).rejects.toThrow("Ollama generate failed (502)");
  });

  it("send generate streaming ignores invalid json lines", async () => {
    mockFetch({
      "/api/generate": new Response(ndjsonBody(["{bad", '{"response":"Z"}']), {
        status: 200,
      }),
    });
    expect(
      await ollamaProvider.send(
        { ...baseConfig, mode: "completions" },
        [{ role: "user", content: "x" }],
        () => {}
      )
    ).toBe("Z");
  });

  it("send chat without response body uses json fallback", async () => {
    mockFetch({
      "/api/chat": new Response(JSON.stringify({ message: { content: "Y" } }), {
        status: 200,
      }),
    });
    expect(
      await ollamaProvider.send(baseConfig, [{ role: "user", content: "x" }], () => {})
    ).toBe("Y");
  });
});

describe("openaiCompatibleProvider", () => {
  const openaiBase = { ...baseConfig, baseUrl: "https://api.example/" };

  it("listModels", async () => {
    mockFetch({
      "/v1/models": new Response(
        JSON.stringify({ data: [{ id: "gpt" }, { id: "" }] }),
        { status: 200 }
      ),
    });
    expect(await openaiCompatibleProvider.listModels("https://api.example/")).toEqual([
      "gpt",
    ]);
  });

  it("listModels failure", async () => {
    mockFetch({ "/v1/models": new Response("", { status: 401 }) });
    await expect(openaiCompatibleProvider.listModels("https://x")).rejects.toThrow(
      "Models request failed (401)"
    );
  });

  it("chat completions non-stream", async () => {
    mockFetch({
      "/v1/chat/completions": new Response(
        JSON.stringify({ choices: [{ message: { content: "OK" } }] }),
        { status: 200 }
      ),
    });
    const text = await openaiCompatibleProvider.send(
      { ...openaiBase, systemPrompt: "You are helpful" },
      [{ role: "user", content: "Hi" }]
    );
    expect(text).toBe("OK");
  });

  it("chat completions sends multimodal content for images", async () => {
    mockFetch({
      "/v1/chat/completions": new Response(
        JSON.stringify({ choices: [{ message: { content: "OK" } }] }),
        { status: 200 }
      ),
    });
    await openaiCompatibleProvider.send(openaiBase, [
      {
        role: "user",
        content: "Describe",
        images: [{ mimeType: "image/jpeg", data: "Zm9v" }],
      },
    ]);
    const init = /** @type {RequestInit} */ (fetch.mock.calls[0][1]);
    const body = JSON.parse(String(init.body));
    expect(body.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "Describe" },
          {
            type: "image_url",
            image_url: { url: "data:image/jpeg;base64,Zm9v" },
          },
        ],
      },
    ]);
  });

  it("chat completions stream with reasoning", async () => {
    mockFetch({
      "/v1/chat/completions": new Response(
        sseBody([
          'data: {"choices":[{"delta":{"reasoning_content":"why"}}]}',
          'data: {"choices":[{"delta":{"content":"Hi"}}]}',
          "data: [DONE]",
          "data: {bad",
        ]),
        { status: 200 }
      ),
    });
    const chunks = [];
    const full = await openaiCompatibleProvider.send(
      openaiBase,
      [{ role: "user", content: "Hi" }],
      (c) => chunks.push(c)
    );
    expect(full.length).toBeGreaterThan(0);
    expect(chunks.join("")).toBe(full);
  });

  it("chat completions stream reasoning-only delta field", async () => {
    mockFetch({
      "/v1/chat/completions": new Response(
        sseBody(['data: {"choices":[{"delta":{"reasoning":"r1"}}]}']),
        { status: 200 }
      ),
    });
    const full = await openaiCompatibleProvider.send(
      openaiBase,
      [{ role: "user", content: "Hi" }],
      () => {}
    );
    expect(full).toContain("r1");
  });

  it("chat completions error", async () => {
    mockFetch({
      "/v1/chat/completions": new Response("nope", { status: 500 }),
    });
    await expect(
      openaiCompatibleProvider.send(openaiBase, [{ role: "user", content: "x" }])
    ).rejects.toThrow("Chat completion failed (500): nope");
  });

  it("completions mode non-stream and stream", async () => {
    mockFetch({
      "/v1/completions": new Response(
        JSON.stringify({ choices: [{ text: "T" }] }),
        { status: 200 }
      ),
    });
    expect(
      await openaiCompatibleProvider.send(
        { ...openaiBase, mode: "completions", systemPrompt: "sys" },
        [{ role: "user", content: "Q" }]
      )
    ).toBe("T");

    vi.restoreAllMocks();
    mockFetch({
      "/v1/completions": new Response(
        sseBody([
          'data: {"choices":[{"text":"A"}]}',
          "data: [DONE]",
        ]),
        { status: 200 }
      ),
    });
    const chunks = [];
    expect(
      await openaiCompatibleProvider.send(
        { ...openaiBase, mode: "completions" },
        [{ role: "user", content: "Q" }],
        (c) => chunks.push(c)
      )
    ).toBe("A");
  });

  it("completions error", async () => {
    mockFetch({ "/v1/completions": new Response("", { status: 503 }) });
    await expect(
      openaiCompatibleProvider.send(
        { ...openaiBase, mode: "completions" },
        [{ role: "user", content: "x" }]
      )
    ).rejects.toThrow("Completion failed (503)");
  });

  it("completions stream ignores invalid sse payloads", async () => {
    mockFetch({
      "/v1/completions": new Response(
        sseBody(['data: {"choices":[{"text":"B"}]}', "data: {oops"]),
        { status: 200 }
      ),
    });
    expect(
      await openaiCompatibleProvider.send(
        { ...openaiBase, mode: "completions" },
        [{ role: "user", content: "x" }],
        () => {}
      )
    ).toBe("B");
  });
});
