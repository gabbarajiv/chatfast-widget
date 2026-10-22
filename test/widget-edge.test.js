import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as providers from "../src/providers/index.js";
import { mountChatFast } from "../src/index.js";
import { setInputFiles } from "./setup.js";

/** @param {HTMLElement} el */
function $(el, sel) {
  return el.shadowRoot.querySelector(sel);
}

describe("widget edge coverage", () => {
  beforeEach(() => {
    vi.spyOn(providers, "getProvider").mockReturnValue({
      listModels: vi.fn(),
      send: vi.fn().mockResolvedValue("OK"),
    });
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("falls back when data-config JSON is invalid", () => {
    mountChatFast({
      target: document.body,
      welcomeMessage: "",
      theme: { appearance: "light" },
    }).destroy();
    const el = document.createElement("chatfast-widget");
    el.setAttribute("data-config", "{not-json");
    document.body.appendChild(el);
    expect(el.getConfig().title).toBe("ChatFast");
    el.destroy();
  });

  it("uses speech abort when available", () => {
    /** @type {{ abort: ReturnType<typeof vi.fn> } | undefined} */
    let instance;
    class CapturingSR {
      continuous = false;
      interimResults = true;
      lang = "";
      constructor() {
        instance = this;
        this.abort = vi.fn();
        this.stop = vi.fn();
      }
      start() {}
    }
    window.SpeechRecognition = /** @type {any} */ (CapturingSR);
    window.webkitSpeechRecognition = /** @type {any} */ (CapturingSR);

    const el = mountChatFast({
      target: document.body,
      welcomeMessage: "",
      theme: { appearance: "light" },
      features: { attachments: false, voiceInput: true },
    });
    $(el, ".cf-launcher").click();
    $(el, ".cf-mic").click();
    $(el, ".cf-mic").click();
    expect(instance?.abort).toHaveBeenCalled();
    el.destroy();
  });

  it("recovers busy state when image encoding fails", async () => {
    class FailReader {
      /** @type {(() => void) | null} */
      onerror = null;
      readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    }
    const RealReader = globalThis.FileReader;
    // @ts-expect-error test stub
    globalThis.FileReader = FailReader;

    const el = mountChatFast({
      target: document.body,
      welcomeMessage: "",
      theme: { appearance: "light" },
    });
    $(el, ".cf-launcher").click();
    const fileInput = /** @type {HTMLInputElement} */ ($(el, ".cf-file-input"));
    setInputFiles(fileInput, [
      new File(["x"], "pic.png", { type: "image/png" }),
    ]);
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Hi";
    $(el, ".cf-send").click();
    await vi.waitFor(() =>
      expect(/** @type {HTMLButtonElement} */ ($(el, ".cf-send")).disabled).toBe(
        false
      )
    );

    globalThis.FileReader = RealReader;
    el.destroy();
  });

  it("skips empty file selection changes", () => {
    const el = mountChatFast({
      target: document.body,
      welcomeMessage: "",
      theme: { appearance: "light" },
    });
    $(el, ".cf-launcher").click();
    const fileInput = /** @type {HTMLInputElement} */ ($(el, ".cf-file-input"));
    setInputFiles(fileInput, []);
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect($(el, ".cf-attachments").hidden).toBe(true);
    el.destroy();
  });
});
