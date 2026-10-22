import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_CONFIG,
  loadEmbedChatConfig,
  mountChatFast,
  mountChatFastFromUrl,
  mountEmbedChat,
  listModels,
  testConnection,
  WIDGET_VERSION,
} from "../src/index.js";

describe("index exports", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports version and defaults", () => {
    expect(WIDGET_VERSION).toBeTruthy();
    expect(DEFAULT_CONFIG.title).toBe("ChatFast");
  });

  it("mountChatFast registers element and applies config", () => {
    const el = mountChatFast({
      target: document.body,
      title: "Mounted",
      theme: { appearance: "light" },
      features: { attachments: false, voiceInput: false },
    });
    expect(el.tagName.toLowerCase()).toBe("chatfast-widget");
    expect(el.getConfig().title).toBe("Mounted");
    expect(customElements.get("chatfast-widget")).toBeTruthy();
    expect(customElements.get("embed-chat-widget")).toBeTruthy();
  });

  it("mountEmbedChat aliases mountChatFast", () => {
    const el = mountEmbedChat({
      title: "Legacy",
      theme: { appearance: "light" },
      features: { attachments: false, voiceInput: false },
    });
    expect(el.getConfig().title).toBe("Legacy");
  });

  it("mountChatFastFromUrl loads config then mounts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ title: "From URL" }), { status: 200 })
    );
    const el = await mountChatFastFromUrl("/widget-config.json", {
      target: document.body,
      subtitle: "Local",
      theme: { appearance: "light" },
      features: { attachments: false, voiceInput: false },
    });
    expect(el.getConfig().title).toBe("From URL");
    expect(el.getConfig().subtitle).toBe("Local");
  });

  it("listModels and testConnection delegate to provider", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/api/tags")) {
        return new Response(JSON.stringify({ models: [{ name: "m1" }] }), {
          status: 200,
        });
      }
      if (String(url).includes("/api/chat")) {
        return new Response(JSON.stringify({ message: { content: "OK" } }), {
          status: 200,
        });
      }
      return new Response("", { status: 404 });
    });

    await expect(
      listModels({ baseUrl: "http://localhost:11434", provider: "ollama" })
    ).resolves.toEqual(["m1"]);

    await expect(
      testConnection({
        baseUrl: "http://localhost:11434",
        provider: "ollama",
        model: "m1",
      })
    ).resolves.toBe("OK");

    await expect(
      listModels({ baseUrl: "http://localhost:11434" })
    ).resolves.toEqual(["m1"]);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/api/generate")) {
        return new Response(JSON.stringify({ response: "OK" }), { status: 200 });
      }
      return new Response("", { status: 404 });
    });
    await expect(
      testConnection({
        baseUrl: "http://localhost:11434",
        model: "m1",
        mode: "completions",
      })
    ).resolves.toBe("OK");
  });
});
