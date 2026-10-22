import { getProvider } from "./providers/index.js";
import { enhanceCodeBlocks, renderMarkdown } from "./markdown.js";
import { DEFAULT_CONFIG } from "./config-defaults.js";
import { applyTheme, resolveAppearance } from "./theme/apply-theme.js";
import {
  getLauncherIconMarkup,
  THEME_TOGGLE_MOON,
  THEME_TOGGLE_SUN,
} from "./theme/launcher-icons.js";
import {
  ICON_ATTACH,
  ICON_CHEVRON,
  ICON_CLOSE,
  ICON_FILE,
  ICON_MIC,
  ICON_MIC_OFF,
  ICON_CLEAR,
  ICON_REMOVE,
  ICON_SEND,
  ICON_STOP,
  ICON_USER,
} from "./theme/composer-icons.js";
import {
  messagesForApi,
  splitReasoningFromContent,
  stripReasoningForApi,
} from "./message-content.js";
import { mergeEmbedChatConfig } from "./load-config.js";
import { getAssistantAvatarMarkup, getHeaderLogoMarkup } from "./theme/brand-markup.js";
import { resolveWelcomeMessage } from "./greeting.js";
import { WIDGET_VERSION } from "./version.js";
import styles from "./widget.css?inline";

/** @typedef {{ id: string; file: File; previewUrl?: string }} PendingAttachment */

export class ChatFastWidgetElement extends HTMLElement {
  /** @type {import('./types.js').EmbedChatConfig} */
  #config;
  /** @type {import('./types.js').ChatMessage[]} */
  #messages = [];
  #open = false;
  #busy = false;
  /** @type {AbortController | null} */
  #abort = null;
  /** @type {ShadowRoot} */
  #shadow;
  /** @type {Record<string, HTMLElement>} */
  #els = {};
  /** @type {'light' | 'dark' | null} */
  #themeOverride = null;
  /** @type {MediaQueryList | null} */
  #colorSchemeMq = null;
  /** @type {(() => void) | null} */
  #onColorSchemeChange = null;
  /** @type {PendingAttachment[]} */
  #pendingAttachments = [];
  /** @type {InstanceType<typeof SpeechRecognition> | null} */
  #speech = null;
  #listening = false;
  /** Text already in the composer when the current voice session started. */
  #voiceInputPrefix = "";
  /** Finalized transcript chunks for the current voice session. */
  #voiceFinalTranscript = "";
  /** @type {number} */
  #attachId = 0;

  static get observedAttributes() {
    return ["data-config"];
  }

  connectedCallback() {
    this.#shadow = this.attachShadow({ mode: "open" });
    const initial = this.#readConfigFromAttribute();
    this.#config = mergeEmbedChatConfig(initial);
    this.#renderShell();
    this.#applyConfig(this.#config);
    this.#resetConversation(false);
  }

  attributeChangedCallback(name) {
    if (name === "data-config" && this.#shadow) {
      this.#applyConfig(this.#readConfigFromAttribute());
    }
  }

  /** @param {import('./types.js').EmbedChatConfig} config */
  setConfig(config) {
    this.setAttribute("data-config", JSON.stringify(config));
  }

  getConfig() {
    return this.#config;
  }

  destroy() {
    this.#abort?.abort();
    this.#stopVoice();
    this.#clearPendingAttachments();
    this.#detachColorSchemeListener();
    this.remove();
  }

  disconnectedCallback() {
    this.#detachColorSchemeListener();
  }

  #readConfigFromAttribute() {
    const raw = this.getAttribute("data-config");
    if (!raw) {
      return {};
    }
    try {
      return /** @type {import('./types.js').EmbedChatConfig} */ (JSON.parse(raw));
    } catch {
      console.warn("[ChatFast] Invalid data-config JSON; using defaults.");
      return {};
    }
  }

  /** @param {import('./types.js').EmbedChatConfig} config */
  #applyConfig(config) {
    this.#config = mergeEmbedChatConfig(config);
    const appearance = applyTheme(/** @type {HTMLElement} */ (this), this.#config.theme, {
      override: this.#themeOverride,
    });
    this.#detachColorSchemeListener();
    this.#attachColorSchemeListener();
    if (!this.#els.title) return;
    this.#applyLauncherIcon();
    this.#applyHeaderLogo();
    this.#syncThemeToggle(appearance);
    this.#els.title.textContent = this.#config.title ?? "ChatFast";
    if (this.#els.subtitle) {
      const sub = this.#config.subtitle ?? DEFAULT_CONFIG.subtitle ?? "";
      this.#els.subtitle.textContent = sub;
      this.#els.subtitle.hidden = !sub;
    }
    this.#syncComposerFeatures();
    const root = this.#root();
    const inline = this.#config.layout === "inline";
    if (root) {
      root.classList.toggle("cf-inline", inline);
      root.classList.toggle(
        "cf-left",
        !inline && this.#config.position === "bottom-left"
      );
    }
    const host = /** @type {HTMLElement} */ (this);
    if (this.#config.panelWidth) {
      host.style.setProperty("--cf-panel-width", `${this.#config.panelWidth}px`);
    } else {
      host.style.removeProperty("--cf-panel-width");
    }
    if (this.#config.panelHeight) {
      host.style.setProperty("--cf-panel-height", `${this.#config.panelHeight}px`);
    } else {
      host.style.removeProperty("--cf-panel-height");
    }
    if (inline && this.#els.panel) {
      this.#toggle(true);
    }
    if (this.#config.placeholder) {
      this.#els.input.placeholder = this.#config.placeholder;
    }
    this.#renderStarterPrompts();
  }

  #root() {
    return this.#shadow.querySelector(".cf-root");
  }

  #applyLauncherIcon() {
    if (!this.#els.launcherIcon) return;
    this.#els.launcherIcon.innerHTML = getLauncherIconMarkup(this.#config?.theme);
  }

  #applyHeaderLogo() {
    if (!this.#els.headerLogo) return;
    this.#els.headerLogo.innerHTML = getHeaderLogoMarkup(this.#config?.theme);
  }

  /**
   * @param {'light' | 'dark'} appearance
   */
  #syncThemeToggle(appearance) {
    const btn = this.#els.themeToggle;
    if (!btn) return;
    const show = this.#config.theme?.showThemeToggle !== false;
    btn.hidden = !show;
    if (!show) return;
    const isDark = appearance === "dark";
    btn.innerHTML = isDark ? THEME_TOGGLE_SUN : THEME_TOGGLE_MOON;
    btn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
    btn.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  #toggleTheme() {
    const current = resolveAppearance(this.#config.theme, this.#themeOverride);
    this.#themeOverride = current === "dark" ? "light" : "dark";
    this.#detachColorSchemeListener();
    const next = applyTheme(/** @type {HTMLElement} */ (this), this.#config.theme, {
      override: this.#themeOverride,
    });
    this.#syncThemeToggle(next);
  }

  #attachColorSchemeListener() {
    if (this.#colorSchemeMq) return;
    if (this.#config.theme?.appearance !== "auto" || this.#themeOverride) {
      return;
    }
    this.#colorSchemeMq = window.matchMedia("(prefers-color-scheme: dark)");
    this.#onColorSchemeChange = () => {
      if (this.#themeOverride) return;
      const appearance = applyTheme(
        /** @type {HTMLElement} */ (this),
        this.#config.theme
      );
      this.#syncThemeToggle(appearance);
    };
    this.#colorSchemeMq.addEventListener("change", this.#onColorSchemeChange);
  }

  #detachColorSchemeListener() {
    if (this.#colorSchemeMq && this.#onColorSchemeChange) {
      this.#colorSchemeMq.removeEventListener("change", this.#onColorSchemeChange);
    }
    this.#colorSchemeMq = null;
    this.#onColorSchemeChange = null;
  }

  #renderShell() {
    this.#shadow.innerHTML = `
      <style>${styles}</style>
      <div class="cf-root" part="root">
        <div class="cf-panel" part="panel">
          <header class="cf-header">
            <div class="cf-header-brand">
              <span class="cf-header-logo" aria-hidden="true"></span>
              <div class="cf-header-text">
                <h2 class="cf-title"></h2>
                <p class="cf-subtitle"></p>
              </div>
            </div>
            <div class="cf-header-actions">
              <button type="button" class="cf-icon-btn cf-theme-toggle" title="Toggle dark mode" aria-label="Toggle dark mode" hidden></button>
              <button type="button" class="cf-icon-btn cf-close" title="Close" aria-label="Close">${ICON_CLOSE}</button>
            </div>
          </header>
          <div class="cf-starters" part="starters"></div>
          <div class="cf-messages" part="messages"></div>
          <div class="cf-error" role="alert"></div>
          <div class="cf-composer">
            <div class="cf-attachments" part="attachments" hidden></div>
            <div class="cf-composer-card">
              <textarea class="cf-input" rows="1" placeholder="Ask anything…"></textarea>
              <div class="cf-composer-toolbar">
                <div class="cf-composer-tools">
                  <button type="button" class="cf-tool cf-attach" title="Attach files" aria-label="Attach files">${ICON_ATTACH}</button>
                  <button type="button" class="cf-tool cf-mic" title="Voice input" aria-label="Voice input">${ICON_MIC}</button>
                </div>
                <div class="cf-composer-actions">
                  <button type="button" class="cf-icon-action cf-clear" title="Clear chat" aria-label="Clear chat">${ICON_CLEAR}</button>
                  <button type="button" class="cf-icon-action cf-stop" title="Stop generating" aria-label="Stop generating">${ICON_STOP}</button>
                  <button type="button" class="cf-icon-action cf-send" title="Send message" aria-label="Send message">${ICON_SEND}</button>
                </div>
              </div>
            </div>
            <input type="file" class="cf-file-input" hidden multiple accept="image/*,.pdf,.txt,.md,.doc,.docx,.csv" />
            <p class="cf-footer-hint">ChatFast v${WIDGET_VERSION}</p>
          </div>
        </div>
        <div class="cf-launcher-wrap">
          <button type="button" class="cf-launcher" aria-label="Open chat">
            <span class="cf-launcher-icon"></span>
          </button>
        </div>
      </div>
    `;

    const q = (sel) => /** @type {HTMLElement} */ (this.#shadow.querySelector(sel));
    this.#els = {
      panel: q(".cf-panel"),
      starters: q(".cf-starters"),
      messages: q(".cf-messages"),
      input: /** @type {HTMLTextAreaElement} */ (q(".cf-input")),
      send: /** @type {HTMLButtonElement} */ (q(".cf-send")),
      clear: /** @type {HTMLButtonElement} */ (q(".cf-clear")),
      stop: /** @type {HTMLButtonElement} */ (q(".cf-stop")),
      error: q(".cf-error"),
      launcher: /** @type {HTMLButtonElement} */ (q(".cf-launcher")),
      launcherIcon: q(".cf-launcher-icon"),
      themeToggle: /** @type {HTMLButtonElement} */ (q(".cf-theme-toggle")),
      title: q(".cf-title"),
      subtitle: q(".cf-subtitle"),
      headerLogo: q(".cf-header-logo"),
      attachments: q(".cf-attachments"),
      attachBtn: /** @type {HTMLButtonElement} */ (q(".cf-attach")),
      micBtn: /** @type {HTMLButtonElement} */ (q(".cf-mic")),
      fileInput: /** @type {HTMLInputElement} */ (q(".cf-file-input")),
    };

    this.#applyLauncherIcon();
    this.#els.launcher.addEventListener("click", () => this.#toggle(true));
    this.#els.themeToggle.addEventListener("click", () => this.#toggleTheme());
    q(".cf-close").addEventListener("click", () => this.#toggle(false));
    this.#els.send.addEventListener("click", () => void this.#submit());
    this.#els.clear.addEventListener("click", () => this.#clearChat());
    this.#els.stop.addEventListener("click", () => this.#stopGeneration());
    this.#els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.#submit();
      }
    });
    this.#els.input.addEventListener("input", () => this.#autosizeInput());
    this.#els.attachBtn.addEventListener("click", () => this.#els.fileInput.click());
    this.#els.fileInput.addEventListener("change", () => this.#onFilesSelected());
    this.#els.micBtn.addEventListener("click", () => this.#toggleVoice());
    this.#initSpeechRecognition();
    this.#syncComposerFeatures();
  }

  #featureEnabled(key) {
    const features = this.#config.features ?? {};
    if (key === "attachments") return features.attachments !== false;
    if (key === "voiceInput") return features.voiceInput !== false;
    /* v8 ignore next */
    return true;
  }

  #syncComposerFeatures() {
    if (!this.#els.attachBtn) return;
    const attachOn = this.#featureEnabled("attachments");
    const voiceOn = this.#featureEnabled("voiceInput");
    this.#els.attachBtn.hidden = !attachOn;
    this.#els.micBtn.hidden = !voiceOn;
    if (!voiceOn) this.#stopVoice();
  }

  #initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !this.#featureEnabled("voiceInput")) {
      if (this.#els.micBtn) {
        this.#els.micBtn.disabled = true;
        this.#els.micBtn.title = "Voice input not supported in this browser";
      }
      return;
    }
    this.#speech = new SR();
    this.#speech.continuous = false;
    this.#speech.interimResults = true;
    this.#speech.lang = document.documentElement.lang || "en-US";
    this.#speech.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          this.#voiceFinalTranscript += text;
        } else {
          interim += text;
        }
      }
      this.#applyVoiceTranscript(interim);
    };
    this.#speech.onend = () => {
      this.#listening = false;
      this.#voiceInputPrefix = "";
      this.#voiceFinalTranscript = "";
      this.#els.micBtn.classList.remove("cf-active");
      this.#els.micBtn.innerHTML = ICON_MIC;
      this.#els.micBtn.setAttribute("aria-label", "Voice input");
    };
    this.#speech.onerror = () => {
      this.#stopVoice();
    };
  }

  #applyVoiceTranscript(interim = "") {
    const parts = [
      this.#voiceInputPrefix,
      this.#voiceFinalTranscript.trim(),
      interim.trim(),
    ].filter(Boolean);
    this.#els.input.value = parts.join(" ");
    this.#autosizeInput();
  }

  #beginVoiceSession() {
    this.#voiceInputPrefix = this.#els.input.value.trimEnd();
    this.#voiceFinalTranscript = "";
  }

  #toggleVoice() {
    if (!this.#speech || this.#busy) return;
    if (this.#listening) {
      this.#stopVoice();
      return;
    }
    this.#beginVoiceSession();
    this.#listening = true;
    this.#els.micBtn.classList.add("cf-active");
    this.#els.micBtn.innerHTML = ICON_MIC_OFF;
    this.#els.micBtn.setAttribute("aria-label", "Stop voice input");
    try {
      this.#speech.start();
    } catch {
      this.#stopVoice();
    }
  }

  #stopVoice() {
    if (!this.#speech) return;
    this.#listening = false;
    this.#voiceInputPrefix = "";
    this.#voiceFinalTranscript = "";
    try {
      if (typeof this.#speech.abort === "function") {
        this.#speech.abort();
      } else {
        this.#speech.stop();
      }
    } catch {
      /* ignore */
    }
    if (this.#els.micBtn) {
      this.#els.micBtn.classList.remove("cf-active");
      this.#els.micBtn.innerHTML = ICON_MIC;
      this.#els.micBtn.setAttribute("aria-label", "Voice input");
    }
  }

  #onFilesSelected() {
    const input = this.#els.fileInput;
    const files = input.files ? [...input.files] : [];
    input.value = "";
    if (!files.length) return;
    for (const file of files) {
      /** @type {PendingAttachment} */
      const item = {
        id: `att-${++this.#attachId}`,
        file,
      };
      if (file.type.startsWith("image/")) {
        item.previewUrl = URL.createObjectURL(file);
      }
      this.#pendingAttachments.push(item);
    }
    this.#renderPendingAttachments();
  }

  #renderPendingAttachments() {
    const el = this.#els.attachments;
    el.innerHTML = "";
    if (!this.#pendingAttachments.length) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    for (const item of this.#pendingAttachments) {
      const chip = document.createElement("div");
      chip.className = "cf-attachment-chip";
      if (item.previewUrl) {
        const img = document.createElement("img");
        img.src = item.previewUrl;
        img.alt = "";
        chip.appendChild(img);
      } else {
        const icon = document.createElement("span");
        icon.className = "cf-attachment-file-icon";
        icon.innerHTML = ICON_FILE;
        chip.appendChild(icon);
      }
      const label = document.createElement("span");
      label.className = "cf-attachment-name";
      label.textContent = item.file.name;
      chip.appendChild(label);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cf-attachment-remove";
      remove.innerHTML = ICON_REMOVE;
      remove.setAttribute("aria-label", `Remove ${item.file.name}`);
      remove.addEventListener("click", () => this.#removeAttachment(item.id));
      chip.appendChild(remove);
      el.appendChild(chip);
    }
  }

  /** @param {string} id */
  #removeAttachment(id) {
    const item = this.#pendingAttachments.find((a) => a.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    this.#pendingAttachments = this.#pendingAttachments.filter((a) => a.id !== id);
    this.#renderPendingAttachments();
  }

  /** @returns {PendingAttachment[]} */
  #takePendingAttachments() {
    const taken = [...this.#pendingAttachments];
    this.#pendingAttachments = [];
    this.#renderPendingAttachments();
    return taken;
  }

  #clearPendingAttachments() {
    for (const item of this.#pendingAttachments) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    this.#pendingAttachments = [];
    this.#renderPendingAttachments();
  }

  /**
   * @param {PendingAttachment[]} attachments
   * @returns {string}
   */
  #attachmentsSummary(attachments) {
    if (!attachments.length) return "";
    const names = attachments.map((a) => a.file.name).join(", ");
    return `\n\n[Attached files: ${names}]`;
  }

  /**
   * @param {HTMLElement} bubble
   * @param {PendingAttachment[]} attachments
   */
  #renderMessageAttachments(bubble, attachments) {
    if (!attachments.length) return;
    const wrap = document.createElement("div");
    wrap.className = "cf-msg-attachments";
    for (const item of attachments) {
      if (item.previewUrl) {
        const img = document.createElement("img");
        img.src = item.previewUrl;
        img.alt = item.file.name;
        img.className = "cf-msg-attachment-img";
        wrap.appendChild(img);
      } else {
        const pill = document.createElement("div");
        pill.className = "cf-msg-attachment-file";
        pill.innerHTML = `${ICON_FILE}<span>${item.file.name}</span>`;
        wrap.appendChild(pill);
      }
    }
    bubble.appendChild(wrap);
  }

  #autosizeInput() {
    const el = this.#els.input;
    el.style.height = "auto";
    if (!el.value) {
      el.style.height = "";
      return;
    }
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  /**
   * @param {File} file
   * @returns {Promise<import('./types.js').ChatMessageImage | null>}
   */
  async #fileToApiImage(file) {
    if (!file.type.startsWith("image/")) return null;
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Unexpected file read result"));
          return;
        }
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
      reader.readAsDataURL(file);
    });
    return { mimeType: file.type, data };
  }

  /**
   * @param {PendingAttachment[]} attachments
   * @returns {Promise<import('./types.js').ChatMessageImage[]>}
   */
  async #encodeImageAttachments(attachments) {
    const imageItems = attachments.filter((a) => a.file.type.startsWith("image/"));
    if (!imageItems.length) return [];
    const images = [];
    for (const item of imageItems) {
      const encoded = await this.#fileToApiImage(item.file);
      if (encoded) images.push(encoded);
    }
    return images;
  }

  /** @param {boolean} open */
  #toggle(open) {
    this.#open = open;
    this.#els.panel.classList.toggle("cf-open", open);
    this.#root()?.classList.toggle("cf-chat-open", open);
    this.#els.launcher.setAttribute("aria-hidden", open ? "true" : "false");
    this.#els.launcher.tabIndex = open ? -1 : 0;
    if (open) {
      this.#els.input.focus();
    } else {
      this.#els.launcher.focus();
    }
  }

  #clearChat() {
    this.#stopVoice();
    this.#resetConversation(true);
  }

  /** @param {boolean} focusInput */
  #resetConversation(focusInput) {
    this.#abort?.abort();
    this.#busy = false;
    this.#messages = [];
    this.#els.messages.innerHTML = "";
    this.#setError(null);
    this.#setBusyUi(false);

    const welcome = resolveWelcomeMessage(this.#config);
    if (welcome) {
      this.#appendAssistantMessage(welcome);
    }
    this.#clearPendingAttachments();
    this.#renderStarterPrompts();
    if (focusInput) this.#els.input.focus();
  }

  #renderStarterPrompts() {
    const prompts = this.#config.starterPrompts ?? DEFAULT_CONFIG.starterPrompts ?? [];
    this.#els.starters.innerHTML = "";
    if (!prompts.length || this.#messages.some((m) => m.role === "user")) {
      this.#els.starters.hidden = true;
      return;
    }
    this.#els.starters.hidden = false;
    for (const text of prompts) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cf-starter";
      btn.textContent = text;
      btn.addEventListener("click", () => {
        this.#els.input.value = text;
        this.#autosizeInput();
        void this.#submit();
      });
      this.#els.starters.appendChild(btn);
    }
  }

  /**
   * @param {import('./types.js').ChatMessage['role']} role
   * @param {string} content
   * @param {{ streaming?: boolean, skipHistory?: boolean, attachments?: PendingAttachment[] }} [opts]
   */
  #appendMessage(role, content, opts = {}) {
    const row = document.createElement("div");
    row.className = `cf-msg-row cf-${role}`;

    const body = document.createElement("div");
    body.className = "cf-msg-body";

    if (role !== "system") {
      const avatar = document.createElement("div");
      avatar.className = `cf-avatar cf-avatar-${role}`;
      avatar.innerHTML =
        role === "assistant"
          ? getAssistantAvatarMarkup(this.#config?.theme)
          : ICON_USER;
      if (role === "assistant" && avatar.querySelector("img")) {
        avatar.classList.add("cf-avatar--brand");
      }
      avatar.setAttribute("aria-hidden", "true");
      body.appendChild(avatar);
    }

    const column = document.createElement("div");
    column.className = "cf-msg-column";

    const bubble = document.createElement("div");
    bubble.className = `cf-msg cf-msg-${role}`;
    if (role === "assistant") {
      this.#setAssistantContent(bubble, content, opts.streaming);
    } else if (role === "user") {
      if (content) {
        const text = document.createElement("div");
        text.className = "cf-msg-text";
        text.textContent = content;
        bubble.appendChild(text);
      }
      if (opts.attachments?.length) {
        this.#renderMessageAttachments(bubble, opts.attachments);
      }
      const copyParts = [content, ...(opts.attachments?.map((a) => a.file.name) ?? [])].filter(
        Boolean
      );
      bubble.dataset.rawContent = copyParts.join("\n");
    }
    if (opts.streaming) bubble.classList.add("cf-streaming");

    column.appendChild(bubble);

    if (role !== "system") {
      const meta = document.createElement("div");
      meta.className = "cf-msg-meta";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "cf-msg-action";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => void this.#copyText(this.#copyTextForBubble(bubble)));
      meta.appendChild(copyBtn);

      if (role === "assistant") {
        const regen = document.createElement("button");
        regen.type = "button";
        regen.className = "cf-msg-action cf-regen";
        regen.textContent = "Regenerate";
        regen.addEventListener("click", () => void this.#regenerate());
        meta.appendChild(regen);
      }
      column.appendChild(meta);
    }

    body.appendChild(column);
    row.appendChild(body);

    this.#els.messages.appendChild(row);
    this.#scrollMessages();
    return { row, bubble };
  }

  #appendAssistantMessage(content, opts = {}) {
    return this.#appendMessage("assistant", content, opts);
  }

  /**
   * @param {HTMLElement} bubble
   * @param {string} content
   * @param {boolean} [streaming]
   */
  #setAssistantContent(bubble, content, streaming = false) {
    bubble.dataset.rawContent = content;
    const { reasoning, answer, reasoningComplete } = splitReasoningFromContent(content);
    const waitingForTokens = streaming && !content;

    if (waitingForTokens) {
      bubble.classList.add("cf-streaming");
      bubble.innerHTML = `<div class="cf-thinking" aria-live="polite"><span class="cf-thinking-label">Thinking</span><span class="cf-thinking-dots" aria-hidden="true"></span></div>`;
      return;
    }

    bubble.classList.toggle("cf-streaming", streaming && Boolean(answer));
    bubble.replaceChildren();

    if (reasoning) {
      const details = document.createElement("details");
      details.className = "cf-reasoning";
      if (streaming && !reasoningComplete) {
        details.open = true;
      } else if (!answer) {
        details.open = true;
      }
      const summary = document.createElement("summary");
      summary.innerHTML = `<span class="cf-reasoning-icon">${ICON_CHEVRON}</span><span>Reasoning</span>`;
      details.appendChild(summary);
      const body = document.createElement("div");
      body.className = "cf-reasoning-body";
      body.textContent = reasoning;
      if (streaming && !reasoningComplete) {
        body.classList.add("cf-reasoning-live");
      }
      details.appendChild(body);
      bubble.appendChild(details);
    }

    if (answer) {
      const answerEl = document.createElement("div");
      answerEl.className = "cf-msg-answer";
      if (streaming) answerEl.classList.add("cf-streaming");
      answerEl.innerHTML = renderMarkdown(answer);
      enhanceCodeBlocks(answerEl);
      bubble.appendChild(answerEl);
    } else if (!reasoning) {
      bubble.innerHTML = renderMarkdown(content);
      enhanceCodeBlocks(bubble);
      return;
    }

    if (streaming && answer && !reasoningComplete) {
      const tail = document.createElement("div");
      tail.className = "cf-thinking cf-thinking-inline";
      tail.setAttribute("aria-live", "polite");
      tail.innerHTML = `<span class="cf-thinking-label">Thinking</span><span class="cf-thinking-dots" aria-hidden="true"></span>`;
      bubble.appendChild(tail);
    }
  }

  #scrollMessages() {
    this.#els.messages.scrollTop = this.#els.messages.scrollHeight;
  }

  /** @param {string | null} msg */
  #setError(msg) {
    this.#els.error.classList.toggle("cf-visible", Boolean(msg));
    this.#els.error.textContent = msg ?? "";
  }

  /** @param {boolean} busy */
  #setBusyUi(busy) {
    this.#busy = busy;
    this.#els.send.disabled = busy;
    this.#els.stop.classList.toggle("cf-visible", busy);
  }

  /** @param {HTMLElement} bubble */
  #copyTextForBubble(bubble) {
    const raw = bubble.dataset.rawContent;
    if (raw != null) {
      return bubble.classList.contains("cf-msg-assistant")
        ? stripReasoningForApi(raw)
        : raw;
    }
    return bubble.textContent ?? "";
  }

  async #copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  #stopGeneration() {
    this.#abort?.abort();
  }

  async #regenerate() {
    if (this.#busy) return;
    const lastUserIdx = [...this.#messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;

    while (this.#messages.length && this.#messages.at(-1)?.role === "assistant") {
      this.#messages.pop();
      this.#els.messages
        .querySelector(".cf-msg-row.cf-assistant:last-of-type")
        ?.remove();
    }
    await this.#runCompletion({ regenerate: true });
  }

  async #submit() {
    const text = this.#els.input.value.trim();
    const attachments = this.#takePendingAttachments();
    if ((!text && !attachments.length) || this.#busy) return;
    this.#setBusyUi(true);
    try {
      this.#stopVoice();
      this.#els.input.value = "";
      this.#autosizeInput();
      const payload = `${text}${this.#attachmentsSummary(attachments)}`.trim();
      const images = await this.#encodeImageAttachments(attachments);
      /** @type {import('./types.js').ChatMessage} */
      const userMessage = { role: "user", content: payload };
      if (images.length) userMessage.images = images;
      this.#messages.push(userMessage);
      this.#appendMessage("user", text, { attachments });
      this.#renderStarterPrompts();
      await this.#runCompletion({ regenerate: false });
    } catch {
      this.#setBusyUi(false);
    }
  }

  /** @param {{ regenerate: boolean }} opts */
  async #runCompletion(opts) {
    this.#setError(null);
    this.#setBusyUi(true);
    this.#abort = new AbortController();

    const { bubble } = this.#appendAssistantMessage("", { streaming: true });
    let streamed = "";

    try {
      const provider = getProvider(this.#config.provider ?? "ollama");
      const reply = await provider.send(
        { ...this.#config, signal: this.#abort.signal },
        messagesForApi(this.#messages),
        (chunk) => {
          streamed += chunk;
          this.#setAssistantContent(bubble, streamed, true);
          this.#scrollMessages();
        }
      );

      const finalText = streamed || reply;
      bubble.classList.remove("cf-streaming");
      this.#setAssistantContent(bubble, finalText, false);

      this.#messages.push({ role: "assistant", content: finalText });
    } catch (err) {
      bubble.closest(".cf-msg-row")?.remove();
      if (err instanceof Error && err.name === "AbortError") {
        if (streamed) {
          this.#messages.push({ role: "assistant", content: streamed });
        }
      } else {
        if (!opts.regenerate) {
          this.#messages.pop();
        }
        const message = err instanceof Error ? err.message : "Request failed";
        this.#setError(message);
      }
    } finally {
      this.#abort = null;
      this.#setBusyUi(false);
      this.#els.input.focus();
    }
  }
}

/** @deprecated use ChatFastWidgetElement — legacy tag uses EmbedChatLegacyElement in index.js */
export class EmbedChatWidgetElement extends ChatFastWidgetElement {}
