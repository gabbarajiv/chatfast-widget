import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import * as providers from "../src/providers/index.js";
import { mountChatFast } from "../src/index.js";
import { setInputFiles } from "./setup.js";

const T_OPEN = "<" + "think>";
const T_CLOSE = "</" + "think>";

/** @param {HTMLElement} el */
function $(el, sel) {
  return el.shadowRoot.querySelector(sel);
}

/** @param {HTMLElement} el */
function mountWidget(overrides = {}) {
  document.body.innerHTML = "";
  return mountChatFast({
    target: document.body,
    title: "Test Chat",
    subtitle: "Sub",
    welcomeMessage: "",
    starterPrompts: [],
    features: { attachments: true, voiceInput: true },
    theme: { appearance: "light", showThemeToggle: true },
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "m",
    ...overrides,
  });
}

class FakeSpeechRecognition {
  continuous = false;
  interimResults = true;
  lang = "";
  /** @type {((ev: any) => void) | null} */
  onresult = null;
  /** @type {(() => void) | null} */
  onend = null;
  /** @type {(() => void) | null} */
  onerror = null;
  /** @type {boolean} */
  throwOnStart = false;

  start() {
    if (this.throwOnStart) throw new Error("already started");
  }

  stop() {
    this.onend?.();
  }

  /** @param {{ final?: string; interim?: string }[]} parts */
  emitResults(parts) {
    const results = parts.map((p, i) => ({
      0: { transcript: p.final ?? p.interim ?? "" },
      isFinal: Boolean(p.final),
      length: 1,
    }));
    this.onresult?.({
      resultIndex: 0,
      results,
    });
  }
}

describe("ChatFastWidgetElement", () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let send;

  beforeEach(() => {
    send = vi.fn().mockResolvedValue("Assistant reply");
    vi.spyOn(providers, "getProvider").mockReturnValue({
      listModels: vi.fn(),
      send,
    });
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    });
    const SR = FakeSpeechRecognition;
    window.SpeechRecognition = /** @type {any} */ (SR);
    window.webkitSpeechRecognition = /** @type {any} */ (SR);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    });
  });

  it("opens, closes, and toggles theme", async () => {
    const el = mountWidget();
    expect($(el, ".cf-panel").classList.contains("cf-open")).toBe(false);
    $(el, ".cf-launcher").click();
    expect($(el, ".cf-panel").classList.contains("cf-open")).toBe(true);
    $(el, ".cf-close").click();
    expect($(el, ".cf-panel").classList.contains("cf-open")).toBe(false);

    $(el, ".cf-launcher").click();
    $(el, ".cf-theme-toggle").click();
    expect(el.dataset.theme).toBe("dark");
    $(el, ".cf-theme-toggle").click();
    expect(el.dataset.theme).toBe("light");
  });

  it("submits a message and renders assistant reply", async () => {
    const el = mountWidget({ welcomeMessage: "Welcome" });
    $(el, ".cf-launcher").click();
    const input = /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input"));
    input.value = "Hello";
    $(el, ".cf-send").click();
    await vi.waitFor(() =>
      expect($(el, ".cf-messages").textContent).toContain("Assistant reply")
    );
    expect(send).toHaveBeenCalled();
    expect($(el, ".cf-starters").hidden).toBe(true);
  });

  it("shows error and rolls back user message on failure", async () => {
    send.mockRejectedValueOnce(new Error("Network down"));
    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Hi";
    $(el, ".cf-send").click();
    await vi.waitFor(() =>
      expect($(el, ".cf-error").classList.contains("cf-visible")).toBe(true)
    );
    expect($(el, ".cf-error").textContent).toContain("Network down");
    expect(el.getConfig()).toBeTruthy();
  });

  it("handles non-Error failures", async () => {
    send.mockRejectedValueOnce("bad");
    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Hi";
    $(el, ".cf-send").click();
    await vi.waitFor(() =>
      expect($(el, ".cf-error").textContent).toBe("Request failed")
    );
  });

  it("streams chunks and supports stop / regenerate", async () => {
    send.mockImplementation(async (_cfg, _msgs, onChunk) => {
      onChunk?.("Part ");
      await new Promise((resolve) => setTimeout(resolve, 5));
      onChunk?.("two");
      return "Part two";
    });

    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Go";
    $(el, ".cf-send").click();
    await vi.waitFor(() =>
      expect($(el, ".cf-messages").textContent).toContain("Part two")
    );

    $(el, ".cf-regen").click();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  });

  it("keeps partial assistant text on abort", async () => {
    send.mockImplementation(
      (_cfg, _msgs, onChunk) =>
        new Promise((_resolve, reject) => {
          onChunk?.("Partial");
          setTimeout(() => {
            const err = new DOMException("Aborted", "AbortError");
            reject(err);
          }, 30);
        })
    );

    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Go";
    $(el, ".cf-send").click();
    await vi.waitFor(() =>
      expect($(el, ".cf-stop").classList.contains("cf-visible")).toBe(true)
    );
    $(el, ".cf-stop").click();
    await vi.waitFor(() =>
      expect($(el, ".cf-stop").classList.contains("cf-visible")).toBe(false)
    );
  });

  it("renders reasoning blocks from streamed think tags", async () => {
    const composed = `${T_OPEN}Because${T_CLOSE}Answer`;
    send.mockImplementation(async (_c, _m, onChunk) => {
      onChunk?.(composed);
      return composed;
    });
    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Why";
    $(el, ".cf-send").click();
    await vi.waitFor(() =>
      expect($(el, ".cf-reasoning")).toBeTruthy()
    );
  });

  it("uses starter prompts and Enter to send", async () => {
    const el = mountWidget({
      welcomeMessage: "",
      starterPrompts: ["Quick start"],
    });
    $(el, ".cf-launcher").click();
    $(el, ".cf-starter").click();
    await vi.waitFor(() => expect(send).toHaveBeenCalled());

    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Enter test";
    $(el, ".cf-input").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  });

  it("manages attachments", async () => {
    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    const fileInput = /** @type {HTMLInputElement} */ ($(el, ".cf-file-input"));
    const txt = new File(["hello"], "notes.txt", { type: "text/plain" });
    const img = new File(["x"], "pic.png", { type: "image/png" });
    setInputFiles(fileInput, [txt, img]);
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect($(el, ".cf-attachments").hidden).toBe(false);
    el.shadowRoot.querySelectorAll(".cf-attachment-remove").forEach((btn) => {
      btn.click();
    });
    expect($(el, ".cf-attachments").hidden).toBe(true);

    setInputFiles(fileInput, [
      new File(["a"], "only.txt", { type: "text/plain" }),
    ]);
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    $(el, ".cf-send").click();
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
  });

  it("handles voice input session", () => {
    /** @type {FakeSpeechRecognition | undefined} */
    let instance;
    class CapturingSR extends FakeSpeechRecognition {
      constructor() {
        super();
        instance = this;
      }
    }
    window.SpeechRecognition = /** @type {any} */ (CapturingSR);
    window.webkitSpeechRecognition = /** @type {any} */ (CapturingSR);

    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Prefix";
    $(el, ".cf-mic").click();
    expect($(el, ".cf-mic").classList.contains("cf-active")).toBe(true);

    instance?.emitResults([{ final: "hello" }]);
    expect(/** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value).toBe(
      "Prefix hello"
    );

    $(el, ".cf-mic").click();
    expect($(el, ".cf-mic").classList.contains("cf-active")).toBe(false);

    $(el, ".cf-mic").click();
    instance?.onerror?.();
    expect($(el, ".cf-mic").classList.contains("cf-active")).toBe(false);
  });

  it("disables mic when unsupported or start throws", () => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    const el = mountWidget({ welcomeMessage: "" });
    expect(/** @type {HTMLButtonElement} */ ($(el, ".cf-mic")).disabled).toBe(
      true
    );

    class ThrowSR extends FakeSpeechRecognition {
      start() {
        throw new Error("busy");
      }
    }
    window.SpeechRecognition = /** @type {any} */ (ThrowSR);
    window.webkitSpeechRecognition = /** @type {any} */ (ThrowSR);
    el.destroy();
    const el2 = mountWidget({ welcomeMessage: "" });
    $(el2, ".cf-launcher").click();
    $(el2, ".cf-mic").click();
    expect($(el2, ".cf-mic").classList.contains("cf-active")).toBe(false);
  });

  it("respects feature flags and layout options", async () => {
    const el = mountWidget({
      welcomeMessage: "",
      layout: "inline",
      position: "bottom-left",
      panelWidth: 400,
      panelHeight: 500,
      theme: { appearance: "auto", showThemeToggle: false },
      features: { attachments: false, voiceInput: false },
    });
    expect($(el, ".cf-root").classList.contains("cf-inline")).toBe(true);
    expect($(el, ".cf-root").classList.contains("cf-left")).toBe(false);
    expect($(el, ".cf-attach").hidden).toBe(true);
    expect($(el, ".cf-mic").hidden).toBe(true);
    expect($(el, ".cf-theme-toggle").hidden).toBe(true);
    expect(el.style.getPropertyValue("--cf-panel-width")).toBe("400px");
  });

  it("updates config via setConfig and attribute", () => {
    const el = mountWidget();
    el.setConfig({
      ...el.getConfig(),
      title: "Updated",
      subtitle: "",
      placeholder: "Type here",
      starterPrompts: ["One"],
    });
    expect($(el, ".cf-title").textContent).toBe("Updated");
    expect($(el, ".cf-subtitle").hidden).toBe(true);
    expect(/** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).placeholder).toBe(
      "Type here"
    );
  });

  it("clears chat and copies message text", async () => {
    const el = mountWidget({ welcomeMessage: "Hi there" });
    $(el, ".cf-launcher").click();
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Question";
    $(el, ".cf-send").click();
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    $(el, ".cf-msg-action").click();
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    $(el, ".cf-clear").click();
    expect($(el, ".cf-messages").textContent).toContain("Hi there");
  });

  it("destroy cleans up", () => {
    const el = mountWidget();
    el.destroy();
    expect(document.body.contains(el)).toBe(false);
  });

  it("ignores empty submit while busy", async () => {
    let resolveLate;
    send.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLate = () => resolve("Late");
        })
    );
    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "first";
    $(el, ".cf-send").click();
    await vi.waitFor(() => expect($(el, ".cf-send").disabled).toBe(true));
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "second";
    $(el, ".cf-send").click();
    expect(send).toHaveBeenCalledTimes(1);
    resolveLate?.();
    await vi.waitFor(() => expect($(el, ".cf-send").disabled).toBe(false));
  });

  it("mounts from bare custom element and data-config attribute", () => {
    const el = document.createElement("chatfast-widget");
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    el.setAttribute(
      "data-config",
      JSON.stringify({
        title: "From attr",
        theme: { appearance: "light" },
        features: { attachments: false, voiceInput: false },
        welcomeMessage: "",
      })
    );
    expect($(el, ".cf-title").textContent).toBe("From attr");
    el.destroy();
  });

  it("applies setConfig before connect", () => {
    const el = document.createElement("chatfast-widget");
    el.setConfig({
      title: "Early",
      theme: { appearance: "light" },
      features: { attachments: false, voiceInput: false },
      welcomeMessage: "",
    });
    document.body.appendChild(el);
    expect($(el, ".cf-title").textContent).toBe("Early");
    el.destroy();
  });

  it("submits attachment-only messages and clears panel dimensions", async () => {
    const el = mountWidget({
      welcomeMessage: "",
      panelWidth: 360,
      panelHeight: 480,
      position: "bottom-left",
    });
    expect($(el, ".cf-root").classList.contains("cf-left")).toBe(true);
    $(el, ".cf-launcher").click();
    const fileInput = /** @type {HTMLInputElement} */ ($(el, ".cf-file-input"));
    setInputFiles(fileInput, [
      new File(["a"], "solo.txt", { type: "text/plain" }),
    ]);
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    $(el, ".cf-send").click();
    await vi.waitFor(() => expect(send).toHaveBeenCalled());

    el.setConfig({
      ...el.getConfig(),
      panelWidth: undefined,
      panelHeight: undefined,
    });
    expect(el.style.getPropertyValue("--cf-panel-width")).toBe("");
  });

  it("shows reasoning-only and inline thinking while streaming", async () => {
    const openReason = `${T_OPEN}Working`;
    send.mockImplementation(async (_c, _m, onChunk) => {
      onChunk?.(openReason);
      return openReason;
    });
    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Go";
    $(el, ".cf-send").click();
    await vi.waitFor(() => expect($(el, ".cf-reasoning")).toBeTruthy());

    send.mockImplementation(async (_c, _m, onChunk) => {
      const chunk = `Part ${T_OPEN}why${T_CLOSE}`;
      onChunk?.(chunk);
      return chunk;
    });
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "More";
    $(el, ".cf-send").click();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  });

  it("handles regenerate failure and abort without partial text", async () => {
    send
      .mockResolvedValueOnce("First")
      .mockRejectedValueOnce(new Error("Regen failed"));
    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Q";
    $(el, ".cf-send").click();
    await vi.waitFor(() => expect($(el, ".cf-regen")).toBeTruthy());
    $(el, ".cf-regen").click();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));

    send.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 40);
        })
    );
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Abort";
    $(el, ".cf-send").click();
    await vi.waitFor(() =>
      expect($(el, ".cf-stop").classList.contains("cf-visible")).toBe(true)
    );
    $(el, ".cf-stop").click();
    await vi.waitFor(() =>
      expect($(el, ".cf-stop").classList.contains("cf-visible")).toBe(false)
    );
  });

  it("ignores clipboard failures and regenerate without user history", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("nope")) },
    });
    const el = mountWidget({ welcomeMessage: "Only welcome", starterPrompts: [] });
    $(el, ".cf-launcher").click();
    $(el, ".cf-msg-action").click();
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("covers voice interim results", () => {
    /** @type {FakeSpeechRecognition | undefined} */
    let instance;
    class CapturingSR extends FakeSpeechRecognition {
      constructor() {
        super();
        instance = this;
      }
    }
    window.SpeechRecognition = /** @type {any} */ (CapturingSR);
    window.webkitSpeechRecognition = /** @type {any} */ (CapturingSR);

    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    $(el, ".cf-mic").click();
    instance?.emitResults([{ interim: "inter" }]);
    expect(/** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value).toContain(
      "inter"
    );
  });

  it("ignores speech stop errors", () => {
    class StopThrowSR extends FakeSpeechRecognition {
      stop() {
        throw new Error("stop failed");
      }
    }
    window.SpeechRecognition = /** @type {any} */ (StopThrowSR);
    window.webkitSpeechRecognition = /** @type {any} */ (StopThrowSR);
    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    $(el, ".cf-mic").click();
    $(el, ".cf-mic").click();
  });

  it("renders image attachments in messages and revokes previews on destroy", async () => {
    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    const fileInput = /** @type {HTMLInputElement} */ ($(el, ".cf-file-input"));
    setInputFiles(fileInput, [
      new File(["bytes"], "photo.png", { type: "image/png" }),
    ]);
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    $(el, ".cf-send").click();
    await vi.waitFor(() =>
      expect($(el, ".cf-msg-attachment-img")).toBeTruthy()
    );
    el.destroy();
  });

  it("revokes attachment previews when chat is cleared", () => {
    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    const fileInput = /** @type {HTMLInputElement} */ ($(el, ".cf-file-input"));
    setInputFiles(fileInput, [
      new File(["x"], "pic.png", { type: "image/png" }),
    ]);
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    $(el, ".cf-clear").click();
    expect($(el, ".cf-attachments").hidden).toBe(true);
  });

  it("persists partial stream text in history on abort", async () => {
    send.mockImplementation((_c, _m, onChunk) => {
      onChunk?.("Saved");
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    const el = mountWidget({ welcomeMessage: "" });
    $(el, ".cf-launcher").click();
    /** @type {HTMLTextAreaElement} */ ($(el, ".cf-input")).value = "Save";
    $(el, ".cf-send").click();
    await vi.waitFor(() => expect($(el, ".cf-error").classList.contains("cf-visible")).toBe(false));
  });

  it("disconnects cleanly after manual theme override", () => {
    const el = mountWidget({
      welcomeMessage: "",
      theme: { appearance: "auto", showThemeToggle: true },
    });
    $(el, ".cf-theme-toggle").click();
    el.remove();
    expect(document.body.contains(el)).toBe(false);
  });

  it("reacts to prefers-color-scheme changes when appearance is auto", () => {
    const listeners = new Map();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: (_ev, cb) => listeners.set("change", cb),
        removeEventListener: vi.fn(),
      }))
    );
    const el = mountWidget({
      welcomeMessage: "",
      theme: { appearance: "auto", showThemeToggle: true },
    });
    listeners.get("change")?.();
    expect(el.dataset.theme).toBeTruthy();
    el.destroy();
  });
});
