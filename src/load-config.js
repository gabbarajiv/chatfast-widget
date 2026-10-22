import { DEFAULT_CONFIG } from "./config-defaults.js";

/**
 * @param {string} url
 * @param {Partial<import('./types.js').EmbedChatConfig>} [overrides]
 * @returns {Promise<import('./types.js').EmbedChatConfig>}
 */
export async function loadEmbedChatConfig(url, overrides = {}) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load widget config (${res.status})`);
  }
  const data = /** @type {Partial<import('./types.js').EmbedChatConfig>} */ (
    await res.json()
  );
  return mergeEmbedChatConfig(DEFAULT_CONFIG, data, overrides);
}

/**
 * @param {...Partial<import('./types.js').EmbedChatConfig>} layers
 * @returns {import('./types.js').EmbedChatConfig}
 */
export function mergeEmbedChatConfig(...layers) {
  /** @type {import('./types.js').EmbedChatConfig} */
  const merged = /** @type {import('./types.js').EmbedChatConfig} */ ({
    ...DEFAULT_CONFIG,
  });
  for (const layer of layers) {
    if (!layer) continue;
    const { theme, auth, ...rest } = layer;
    Object.assign(merged, rest);
    if (theme) {
      merged.theme = {
        ...merged.theme,
        ...theme,
        dark: { ...merged.theme?.dark, ...theme.dark },
      };
    }
    if (auth) {
      merged.auth = { ...merged.auth, ...auth };
    }
  }
  return merged;
}
