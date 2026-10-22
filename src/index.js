import {
  ChatFastWidgetElement,
  EmbedChatWidgetElement,
} from "./widget.js";
import { getProvider, ollamaProvider } from "./providers/index.js";
import {
  loadEmbedChatConfig,
  mergeEmbedChatConfig,
} from "./load-config.js";
import { DEFAULT_CONFIG } from "./config-defaults.js";
import { WIDGET_VERSION } from "./version.js";
import {
  configFromScriptDataset,
  INLINE_CONFIG_GLOBAL_KEYS,
  readInlineEmbedConfig,
} from "./embed-config.js";
import { createAutoMount } from "./auto-mount.js";

export {
  ChatFastWidgetElement,
  EmbedChatWidgetElement,
  getProvider,
  ollamaProvider,
  DEFAULT_CONFIG,
  WIDGET_VERSION,
  loadEmbedChatConfig,
  mergeEmbedChatConfig,
  configFromScriptDataset,
  INLINE_CONFIG_GLOBAL_KEYS,
  readInlineEmbedConfig,
};

const TAG = "chatfast-widget";
const LEGACY_TAG = "embed-chat-widget";

/** Separate class required — one constructor can only be registered once. */
class EmbedChatLegacyElement extends ChatFastWidgetElement {}

function ensureRegistered() {
  if (!customElements.get(TAG)) {
    customElements.define(TAG, ChatFastWidgetElement);
  }
  if (!customElements.get(LEGACY_TAG)) {
    customElements.define(LEGACY_TAG, EmbedChatLegacyElement);
  }
}

/**
 * @typedef {import('./types.js').EmbedChatConfig} EmbedChatConfig
 * @typedef {EmbedChatConfig & { target?: HTMLElement }} MountOptions
 */

/** @param {MountOptions} options */
export function mountChatFast(options) {
  ensureRegistered();
  const { target, ...config } = options;
  const el = document.createElement(TAG);
  el.setConfig(/** @type {EmbedChatConfig} */ (config));
  (target ?? document.body).appendChild(el);
  return el;
}

/** @param {MountOptions} options */
export function mountEmbedChat(options) {
  return mountChatFast(options);
}

/**
 * @param {string} url
 * @param {MountOptions} [options]
 */
export async function mountChatFastFromUrl(url, options = {}) {
  const { target, ...overrides } = options;
  const config = await loadEmbedChatConfig(url, overrides);
  return mountChatFast({ ...config, target });
}

/** @param {Pick<EmbedChatConfig, 'baseUrl' | 'provider' | 'apiKey'>} config */
export async function listModels(config) {
  const provider = getProvider(config.provider ?? "ollama");
  return provider.listModels(config.baseUrl, config.apiKey);
}

/** @param {EmbedChatConfig} config */
export async function testConnection(config) {
  const provider = getProvider(config.provider ?? "ollama");
  return provider.send(
    { ...config, mode: config.mode ?? "chat" },
    [{ role: "user", content: "Reply with exactly: OK" }]
  );
}

const { autoMountChatFast, runAutoMountFromPage } = createAutoMount(mountChatFast);

export { autoMountChatFast };

runAutoMountFromPage(mountChatFast);
