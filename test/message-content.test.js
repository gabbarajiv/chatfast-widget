import { describe, expect, it } from "vitest";
import {
  composeReasoningStream,
  messagesForApi,
  splitReasoningFromContent,
  stripReasoningForApi,
} from "../src/message-content.js";

const T_OPEN = "<" + "think>";
const T_CLOSE = "</" + "think>";

describe("splitReasoningFromContent", () => {
  it("handles empty and plain text", () => {
    expect(splitReasoningFromContent("")).toEqual({
      reasoning: "",
      answer: "",
      reasoningComplete: true,
    });
    expect(splitReasoningFromContent(null)).toEqual({
      reasoning: "",
      answer: "",
      reasoningComplete: true,
    });
    expect(splitReasoningFromContent("Hello")).toEqual({
      reasoning: "",
      answer: "Hello",
      reasoningComplete: true,
    });
  });

  it("extracts closed think blocks", () => {
    const raw = `Before ${T_OPEN}step one${T_CLOSE} After`;
    expect(splitReasoningFromContent(raw)).toEqual({
      reasoning: "step one",
      answer: "Before  After",
      reasoningComplete: true,
    });
  });

  it("handles open think tail while streaming", () => {
    const raw = `Answer ${T_OPEN}still thinking`;
    expect(splitReasoningFromContent(raw)).toEqual({
      reasoning: "still thinking",
      answer: "Answer",
      reasoningComplete: false,
    });
  });
});

describe("composeReasoningStream", () => {
  it("wraps reasoning and appends answer", () => {
    expect(composeReasoningStream("r", "a", true)).toBe(`${T_OPEN}r${T_CLOSE}a`);
  });

  it("closes tag when answer present even if reasoning incomplete", () => {
    expect(composeReasoningStream("r", "a", false)).toBe(`${T_OPEN}r${T_CLOSE}a`);
  });

  it("leaves tag open when only reasoning streams", () => {
    expect(composeReasoningStream("r", "", false)).toBe(`${T_OPEN}r`);
    expect(composeReasoningStream("", "a", true)).toBe("a");
  });
});

describe("stripReasoningForApi", () => {
  it("returns plain text unchanged", () => {
    expect(stripReasoningForApi("Hello")).toBe("Hello");
    expect(stripReasoningForApi(null)).toBe("");
  });

  it("removes closed think blocks", () => {
    const raw = `Visible ${T_OPEN}hidden${T_CLOSE} end`;
    expect(stripReasoningForApi(raw)).toBe("Visible  end");
  });

  it("removes unclosed think tail", () => {
    const raw = `Answer ${T_OPEN}still thinking`;
    expect(stripReasoningForApi(raw)).toBe("Answer");
  });

  it("trims visible answer", () => {
    const raw = `  hi ${T_OPEN}x${T_CLOSE}  `;
    expect(stripReasoningForApi(raw)).toBe("hi");
  });
});

describe("messagesForApi", () => {
  it("strips assistant content only", () => {
    const messages = [
      { role: "system", content: "sys" },
      { role: "user", content: `user ${T_OPEN}nope${T_CLOSE}` },
      {
        role: "assistant",
        content: `Out ${T_OPEN}secret${T_CLOSE}`,
      },
    ];
    expect(messagesForApi(messages)).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: `user ${T_OPEN}nope${T_CLOSE}` },
      { role: "assistant", content: "Out" },
    ]);
  });

  it("preserves other message fields", () => {
    const img = { mimeType: "image/png", data: "abc" };
    const messages = [
      {
        role: "assistant",
        content: `${T_OPEN}r${T_CLOSE}ok`,
        images: [img],
      },
    ];
    expect(messagesForApi(messages)).toEqual([
      { role: "assistant", content: "ok", images: [img] },
    ]);
  });
});
