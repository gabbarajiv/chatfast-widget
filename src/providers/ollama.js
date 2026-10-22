import { readNdjsonStream } from "./stream.js";

/** @param {string} baseUrl */
function normalizeBase(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

/** @param {string | undefined} apiKey */
function authHeaders(apiKey) {
  if (!apiKey) return {};
  return { Authorization: `Bearer ${apiKey}` };
}

/** @param {import('../types.js').ChatMessage} message */
function ollamaApiMessage(message) {
  /** @type {{ role: string; content: string; images?: string[] }} */
  const out = { role: message.role, content: message.content };
  if (message.role === "user" && message.images?.length) {
    out.images = message.images.map((img) => img.data);
  }
  return out;
}

/** @type {import('./index.js').ChatProvider} */
export const ollamaProvider = {
  async listModels(baseUrl, apiKey) {
    const res = await fetch(`${normalizeBase(baseUrl)}/api/tags`, {
      headers: authHeaders(apiKey),
    });
    if (!res.ok) {
      throw new Error(`Ollama list models failed (${res.status})`);
    }
    const data = await res.json();
    const models = data.models ?? [];
    return models.map((m) => m.name).filter(Boolean);
  },

  async send(config, messages, onChunk) {
    const base = normalizeBase(config.baseUrl);
    const mode = config.mode ?? "chat";

    if (mode === "completions") {
      return sendGenerate(base, config, messages, onChunk);
    }
    return sendChat(base, config, messages, onChunk);
  },
};

/**
 * @param {string} base
 * @param {import('../types.js').EmbedChatConfig} config
 * @param {import('../types.js').ChatMessage[]} messages
 * @param {(chunk: string) => void} [onChunk]
 */
async function sendChat(base, config, messages, onChunk) {
  const apiMessages = [];
  if (config.systemPrompt) {
    apiMessages.push({ role: "system", content: config.systemPrompt });
  }
  for (const m of messages) {
    if (m.role === "system") continue;
    apiMessages.push(ollamaApiMessage(m));
  }

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    signal: config.signal,
    headers: { "Content-Type": "application/json", ...authHeaders(config.apiKey) },
    body: JSON.stringify({
      model: config.model,
      messages: apiMessages,
      stream: Boolean(onChunk),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama chat failed (${res.status})${text ? `: ${text}` : ""}`);
  }

  if (!onChunk || !res.body) {
    const data = await res.json();
    return data.message?.content ?? "";
  }

  let full = "";
  await readNdjsonStream(res.body, (line) => {
    try {
      const data = JSON.parse(line);
      const chunk = data.message?.content ?? "";
      if (chunk) {
        full += chunk;
        onChunk(chunk);
      }
    } catch {
      /* ignore partial lines */
    }
  });
  return full;
}

/**
 * @param {string} base
 * @param {import('../types.js').EmbedChatConfig} config
 * @param {import('../types.js').ChatMessage[]} messages
 * @param {(chunk: string) => void} [onChunk]
 */
async function sendGenerate(base, config, messages, onChunk) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const promptParts = [];
  if (config.systemPrompt) promptParts.push(config.systemPrompt);
  for (const m of messages) {
    if (m.role === "user") promptParts.push(`User: ${m.content}`);
    else if (m.role === "assistant") promptParts.push(`Assistant: ${m.content}`);
  }
  const prompt =
    promptParts.length > 1
      ? promptParts.join("\n\n") + "\n\nAssistant:"
      : (lastUser?.content ?? "");

  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    signal: config.signal,
    headers: { "Content-Type": "application/json", ...authHeaders(config.apiKey) },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: Boolean(onChunk),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama generate failed (${res.status})${text ? `: ${text}` : ""}`
    );
  }

  if (!onChunk || !res.body) {
    const data = await res.json();
    return data.response ?? "";
  }

  let full = "";
  await readNdjsonStream(res.body, (line) => {
    try {
      const data = JSON.parse(line);
      const chunk = data.response ?? "";
      if (chunk) {
        full += chunk;
        onChunk(chunk);
      }
    } catch {
      /* ignore */
    }
  });
  return full;
}
