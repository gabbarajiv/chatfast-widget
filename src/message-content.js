const THINK_OPEN = "<" + "think>";
const THINK_CLOSE = "</" + "think>";
const THINK_BLOCK_RE = new RegExp(
  THINK_OPEN + "([\\s\\S]*?)" + "<\\/think>",
  "gi"
);
const THINK_OPEN_TAIL_RE = new RegExp(
  THINK_OPEN + "([\\s\\S]*)$",
  "i"
);

/**
 * Split model output into optional chain-of-thought and visible answer.
 *
 * @param {string} raw
 * @returns {{ reasoning: string; answer: string; reasoningComplete: boolean }}
 */
export function splitReasoningFromContent(raw) {
  const text = raw ?? "";
  const reasoningParts = [];

  let answer = text.replace(THINK_BLOCK_RE, (_, body) => {
    if (body.trim()) reasoningParts.push(body.trim());
    return "";
  });

  let reasoningComplete = true;
  const openMatch = answer.match(THINK_OPEN_TAIL_RE);
  if (openMatch) {
    reasoningComplete = false;
    if (openMatch[1].trim()) reasoningParts.push(openMatch[1].trim());
    answer = answer.slice(0, openMatch.index);
  }

  return {
    reasoning: reasoningParts.join("\n\n").trim(),
    answer: answer.trim(),
    reasoningComplete,
  };
}

/**
 * @param {string} reasoning
 * @param {string} answer
 * @param {boolean} reasoningComplete
 */
export function composeReasoningStream(reasoning, answer, reasoningComplete) {
  let out = "";
  if (reasoning) {
    out += THINK_OPEN + reasoning;
    if (reasoningComplete || answer) out += THINK_CLOSE;
  }
  return out + answer;
}

/**
 * Strip chain-of-thought markup for API payloads (visible answer only).
 *
 * @param {string} content
 * @returns {string}
 */
export function stripReasoningForApi(content) {
  return splitReasoningFromContent(content).answer;
}

/**
 * @param {import('./types.js').ChatMessage[]} messages
 * @returns {import('./types.js').ChatMessage[]}
 */
export function messagesForApi(messages) {
  return messages.map((message) => {
    if (message.role !== "assistant") return message;
    return {
      ...message,
      content: stripReasoningForApi(message.content),
    };
  });
}
