import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { enhanceCodeBlocks, renderMarkdown } from "../src/markdown.js";

describe("renderMarkdown", () => {
  it("returns empty for falsy input", () => {
    expect(renderMarkdown("")).toBe("");
  });

  it("renders markdown safely", () => {
    const html = renderMarkdown("**bold**");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("<script");
  });
});

describe("enhanceCodeBlocks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds copy buttons and handles clipboard success", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: write } });

    const container = document.createElement("div");
    container.innerHTML = "<pre><code>const x = 1;</code></pre>";
    enhanceCodeBlocks(container);

    const btn = container.querySelector(".cf-code-copy");
    expect(btn).toBeTruthy();
    btn.click();
    await Promise.resolve();
    expect(write).toHaveBeenCalledWith("const x = 1;");
    expect(btn.textContent).toBe("Copied");
    vi.advanceTimersByTime(1500);
    expect(btn.textContent).toBe("Copy");
  });

  it("skips when copy button already exists", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<pre><button class="cf-code-copy"></button><code>x</code></pre>';
    enhanceCodeBlocks(container);
    expect(container.querySelectorAll(".cf-code-copy")).toHaveLength(1);
  });

  it("copies from pre text when code element is missing", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: write } });
    const container = document.createElement("div");
    container.innerHTML = "<pre>plain</pre>";
    enhanceCodeBlocks(container);
    container.querySelector(".cf-code-copy").click();
    await Promise.resolve();
    expect(write).toHaveBeenCalled();
  });

  it("shows Failed when clipboard throws", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const container = document.createElement("div");
    container.innerHTML = "<pre><code>x</code></pre>";
    enhanceCodeBlocks(container);
    container.querySelector(".cf-code-copy").click();
    await Promise.resolve();
    expect(container.querySelector(".cf-code-copy").textContent).toBe("Failed");
  });
});
