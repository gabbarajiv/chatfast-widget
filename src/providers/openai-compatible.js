import { readNdjsonStream } from "./stream.js";
import { composeReasoningStream } from "../message-content.js";

/** @param {string} baseUrl */
function normalizeBase(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

/** @param {import('../types.js').EmbedChatConfig} config */
function authHeaders(config) {
  const headers = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  return headers;
}

/** @param {import('../types.js').ChatMessage} message */
function openAiMessageContent(message) {
  if (!message.images?.length) return message.content;
  /** @type {Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>} */
  const parts = [];
  if (message.content) {
    parts.push({ type: "text", text: message.content });
  }
  for (const img of message.images) {
    parts.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    });
  }
  return parts;
}

/** @type {import('./index.js').ChatProvider} */
export const openaiCompatibleProvider = {
  async listModels(baseUrl, apiKey) {
    const res = await fetch(`${normalizeBase(baseUrl)}/v1/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) {
      throw new Error(`Models request failed (${res.status})`);
    }
    const data = await res.json();
    return (data.data ?? []).map((m) => m.id).filter(Boolean);
  },

  async send(config, messages, onChunk) {
    const base = normalizeBase(config.baseUrl);
    const mode = config.mode ?? "chat";

    if (mode === "completions") {
      return sendCompletions(base, config, messages, onChunk);
    }
    return sendChatCompletions(base, config, messages, onChunk);
  },
};

/**
 * @param {string} base
 * @param {import('../types.js').EmbedChatConfig} config
 * @param {import('../types.js').ChatMessage[]} messages
 * @param {(chunk: string) => void} [onChunk]
 */
async function sendChatCompletions(base, config, messages, onChunk) {
  const apiMessages = [];
  if (config.systemPrompt) {
    apiMessages.push({ role: "system", content: config.systemPrompt });
  }
  for (const m of messages) {
    if (m.role === "system") continue;
    apiMessages.push({ role: m.role, content: openAiMessageContent(m) });
  }

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    signal: config.signal,
    headers: authHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: apiMessages,
      stream: Boolean(onChunk),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Chat completion failed (${res.status})${text ? `: ${text}` : ""}`);
  }

  if (!onChunk || !res.body) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  let reasoning = "";
  let content = "";
  let reasoningClosed = false;
  let full = "";
  await readNdjsonStream(res.body, (line) => {
    const payload = line.replace(/^data:\s*/, "");
    if (payload === "[DONE]") return;
    try {
      const data = JSON.parse(payload);
      const delta = data.choices?.[0]?.delta ?? {};
      const rChunk = delta.reasoning_content ?? delta.reasoning ?? "";
      const cChunk = delta.content ?? "";
      if (rChunk) reasoning += rChunk;
      if (cChunk) {
        if (reasoning && !reasoningClosed) reasoningClosed = true;
        content += cChunk;
      }
      const composed = composeReasoningStream(
        reasoning,
        content,
        reasoningClosed || Boolean(content)
      );
      if (composed.length > full.length) {
        onChunk(composed.slice(full.length));
        full = composed;
      }
    } catch {
      /* ignore */
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
async function sendCompletions(base, config, messages, onChunk) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  let prompt = lastUser?.content ?? "";
  if (config.systemPrompt) {
    prompt = `${config.systemPrompt}\n\n${prompt}`;
  }

  const res = await fetch(`${base}/v1/completions`, {
    method: "POST",
    signal: config.signal,
    headers: authHeaders(config),
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: Boolean(onChunk),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Completion failed (${res.status})${text ? `: ${text}` : ""}`);
  }

  if (!onChunk || !res.body) {
    const data = await res.json();
    return data.choices?.[0]?.text ?? "";
  }

  let full = "";
  await readNdjsonStream(res.body, (line) => {
    const payload = line.replace(/^data:\s*/, "");
    if (payload === "[DONE]") return;
    try {
      const data = JSON.parse(payload);
      const chunk = data.choices?.[0]?.text ?? "";
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
