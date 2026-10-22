import { ollamaProvider } from "./ollama.js";
import { openaiCompatibleProvider } from "./openai-compatible.js";

/**
 * @typedef {import('../types.js').EmbedChatConfig} EmbedChatConfig
 * @typedef {import('../types.js').ChatMessage} ChatMessage
 *
 * @typedef {Object} ChatProvider
 * @property {(baseUrl: string, apiKey?: string) => Promise<string[]>} listModels
 * @property {(
 *   config: EmbedChatConfig,
 *   messages: ChatMessage[],
 *   onChunk?: (chunk: string) => void
 * ) => Promise<string>} send
 */

/** @type {Record<string, ChatProvider>} */
const providers = {
  ollama: ollamaProvider,
  "openai-compatible": openaiCompatibleProvider,
};

/** @param {import('../types.js').ProviderKind} [kind] */
export function getProvider(kind = "ollama") {
  const provider = providers[kind];
  if (!provider) {
    throw new Error(`Unknown provider: ${kind}`);
  }
  return provider;
}

export { ollamaProvider, openaiCompatibleProvider };
