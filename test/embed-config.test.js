import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  configFromScriptDataset,
  readInlineEmbedConfig,
} from "../src/embed-config.js";
import { autoMountChatFast } from "../src/index.js";

describe("readInlineEmbedConfig", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete globalThis.ChatFastConfig;
    delete globalThis.CHATFAST_WIDGET_CONFIG;
    delete globalThis.EmbedChatConfig;
  });

  afterEach(() => {
    delete globalThis.ChatFastConfig;
    delete globalThis.CHATFAST_WIDGET_CONFIG;
    delete globalThis.EmbedChatConfig;
  });

  it("reads window.ChatFastConfig", () => {
    globalThis.ChatFastConfig = {
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
      title: "Support",
    };
    const config = readInlineEmbedConfig();
    expect(config.baseUrl).toBe("http://localhost:11434");
    expect(config.model).toBe("llama3.2");
    expect(config.title).toBe("Support");
  });

  it("reads JSON script tag and merges globals", () => {
    document.body.innerHTML = `<script type="application/json" id="chatfast-embed-config">
      {"title":"From JSON","model":"m1","baseUrl":"http://x"}
    </script>`;
    globalThis.ChatFastConfig = { subtitle: "Online" };
    const config = readInlineEmbedConfig();
    expect(config.title).toBe("From JSON");
    expect(config.subtitle).toBe("Online");
    expect(config.model).toBe("m1");
  });

  it("maps loader script data attributes", () => {
    const script = document.createElement("script");
    script.dataset.baseUrl = "http://localhost:11434";
    script.dataset.model = "gemma3:27b";
    script.dataset.title = "Help";
    expect(configFromScriptDataset(script).baseUrl).toBe("http://localhost:11434");
    expect(configFromScriptDataset(script).model).toBe("gemma3:27b");
  });
});

describe("autoMountChatFast", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete globalThis.ChatFastConfig;
  });

  afterEach(() => {
    delete globalThis.ChatFastConfig;
    document.querySelectorAll("chatfast-widget").forEach((el) => el.remove());
  });

  it("mounts from inline global config", () => {
    globalThis.ChatFastConfig = {
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
      title: "Inline",
      theme: { appearance: "light" },
      features: { attachments: false, voiceInput: false },
      welcomeMessage: "",
    };
    const el = autoMountChatFast({ target: document.body });
    expect(el).toBeTruthy();
    expect(el?.getConfig().title).toBe("Inline");
  });

  it("applies config to an existing chatfast-widget element", () => {
    document.body.innerHTML = "<chatfast-widget></chatfast-widget>";
    globalThis.ChatFastConfig = {
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
      title: "Existing tag",
      theme: { appearance: "light" },
      features: { attachments: false, voiceInput: false },
      welcomeMessage: "",
    };
    const el = autoMountChatFast();
    expect(el?.getConfig().title).toBe("Existing tag");
    expect(document.querySelectorAll("chatfast-widget")).toHaveLength(1);
  });
});
