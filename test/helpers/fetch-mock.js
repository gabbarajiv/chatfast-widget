import { vi } from "vitest";

/**
 * @param {Record<string, Response | (() => Response | Promise<Response>)>} routes
 */
export function mockFetch(routes) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input.url;
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        const res = typeof handler === "function" ? await handler() : handler;
        return res;
      }
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

/**
 * @param {string[]} lines
 */
export function ndjsonBody(lines) {
  const encoder = new TextEncoder();
  const payload = lines.map((l) => `${l}\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

/**
 * @param {string[]} sseLines
 */
export function sseBody(sseLines) {
  const encoder = new TextEncoder();
  const payload = sseLines.map((l) => `${l}\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}
