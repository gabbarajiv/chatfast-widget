/**
 * @param {ReadableStream<Uint8Array>} body
 * @param {(line: string) => void} onLine
 */
export async function readNdjsonStream(body, onLine) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (trimmed) onLine(trimmed);
    }
  }

  const tail = buffer.trim();
  if (tail) onLine(tail);
}
