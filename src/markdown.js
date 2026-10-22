import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * @param {string} text
 * @returns {string}
 */
export function renderMarkdown(text) {
  if (!text) return "";
  const html = marked.parse(text, { async: false });
  return DOMPurify.sanitize(String(html), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target"],
  });
}

/**
 * @param {HTMLElement} container
 */
export function enhanceCodeBlocks(container) {
  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".cf-code-copy")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cf-code-copy";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.textContent ?? pre.textContent ?? "";
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 1500);
      } catch {
        btn.textContent = "Failed";
      }
    });
    pre.appendChild(btn);
  });
}
