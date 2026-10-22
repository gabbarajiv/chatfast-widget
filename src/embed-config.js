import { mergeEmbedChatConfig } from "./load-config.js";

/** @type {readonly string[]} */
export const INLINE_CONFIG_GLOBAL_KEYS = [
  "ChatFastConfig",
  "CHATFAST_WIDGET_CONFIG",
  "EmbedChatConfig",
];

/**
 * Map `data-*` attributes on a loader script to partial embed config.
 * @param {HTMLScriptElement | null | undefined} script
 * @returns {Partial<import('./types.js').EmbedChatConfig>}
 */
export function configFromScriptDataset(script) {
  if (!script?.dataset) {
    return {};
  }
  const d = script.dataset;
  /** @type {Partial<import('./types.js').EmbedChatConfig>} */
  const partial = {};

  if (d.baseUrl) partial.baseUrl = d.baseUrl;
  if (d.model) partial.model = d.model;
  if (d.apiKey) partial.apiKey = d.apiKey;
  if (d.title) partial.title = d.title;
  if (d.subtitle) partial.subtitle = d.subtitle;
  if (d.provider) {
    partial.provider = /** @type {import('./types.js').ProviderKind} */ (d.provider);
  }
  if (d.mode) {
    partial.mode = /** @type {import('./types.js').ChatMode} */ (d.mode);
  }
  if (d.systemPrompt) partial.systemPrompt = d.systemPrompt;
  if (d.placeholder) partial.placeholder = d.placeholder;
  if (d.position) {
    partial.position = /** @type {'bottom-right' | 'bottom-left'} */ (d.position);
  }
  if (d.welcomeMessage) partial.welcomeMessage = d.welcomeMessage;

  if (d.config) {
    try {
      const parsed = /** @type {Partial<import('./types.js').EmbedChatConfig>} */ (
        JSON.parse(d.config)
      );
      return mergeEmbedChatConfig(parsed, partial);
    } catch {
      console.warn("[ChatFast] Invalid data-config JSON on script tag; ignoring.");
    }
  }

  return partial;
}

/**
 * Read embed config from page globals, JSON script tags, and optional loader script attributes.
 * @param {HTMLScriptElement | null | undefined} [script]
 * @returns {import('./types.js').EmbedChatConfig}
 */
export function readInlineEmbedConfig(script) {
  /** @type {Partial<import('./types.js').EmbedChatConfig>[]} */
  const layers = [];

  if (typeof document !== "undefined") {
    const jsonEl =
      document.getElementById("chatfast-embed-config") ??
      document.querySelector(
        'script[type="application/json"][data-chatfast-config]'
      );
    const jsonText = jsonEl?.textContent?.trim();
    if (jsonText) {
      try {
        layers.push(
          /** @type {Partial<import('./types.js').EmbedChatConfig>} */ (
            JSON.parse(jsonText)
          )
        );
      } catch {
        console.warn("[ChatFast] Invalid #chatfast-embed-config JSON; ignoring.");
      }
    }
  }

  if (typeof globalThis !== "undefined") {
    const g = /** @type {Record<string, unknown>} */ (globalThis);
    const customKey = script?.dataset?.chatfastConfigGlobal;
    if (customKey && g[customKey] && typeof g[customKey] === "object") {
      layers.push(
        /** @type {Partial<import('./types.js').EmbedChatConfig>} */ (g[customKey])
      );
    }
    for (const key of INLINE_CONFIG_GLOBAL_KEYS) {
      const value = g[key];
      if (value && typeof value === "object") {
        layers.push(
          /** @type {Partial<import('./types.js').EmbedChatConfig>} */ (value)
        );
      }
    }
  }

  if (script) {
    layers.push(configFromScriptDataset(script));
  }

  return mergeEmbedChatConfig(...layers);
}

/**
 * @param {HTMLScriptElement} script
 * @returns {{ target?: HTMLElement | string; useExistingElement?: boolean }}
 */
export function mountOptionsFromScript(script) {
  /** @type {{ target?: HTMLElement | string; useExistingElement?: boolean }} */
  const options = {};
  const targetSel = script.dataset.chatfastTarget;
  if (targetSel) {
    options.target = targetSel;
  }
  if (script.dataset.chatfastUseExisting === "true") {
    options.useExistingElement = true;
  }
  return options;
}
