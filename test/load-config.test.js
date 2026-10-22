import { describe, expect, it, vi } from "vitest";
import {
  loadEmbedChatConfig,
  mergeEmbedChatConfig,
} from "../src/load-config.js";
import { DEFAULT_CONFIG } from "../src/config-defaults.js";

describe("mergeEmbedChatConfig", () => {
  it("merges layers and theme.dark", () => {
    const merged = mergeEmbedChatConfig(
      { title: "A" },
      null,
      undefined,
      { theme: { primary: "#111", dark: { primary: "#222" } } }
    );
    expect(merged.title).toBe("A");
    expect(merged.theme.primary).toBe("#111");
    expect(merged.theme.dark.primary).toBe("#222");
  });

  it("starts from defaults", () => {
    expect(mergeEmbedChatConfig().title).toBe(DEFAULT_CONFIG.title);
  });
});

describe("loadEmbedChatConfig", () => {
  it("loads JSON and merges overrides", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ title: "Remote" }), { status: 200 })
    );
    const cfg = await loadEmbedChatConfig("/cfg.json", { subtitle: "Sub" });
    expect(cfg.title).toBe("Remote");
    expect(cfg.subtitle).toBe("Sub");
  });

  it("throws on failed response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404 })
    );
    await expect(loadEmbedChatConfig("/bad.json")).rejects.toThrow(
      "Failed to load widget config (404)"
    );
  });
});
