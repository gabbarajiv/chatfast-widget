import { describe, expect, it } from "vitest";
import {
  getHeaderLogoMarkup,
  sanitizeBrandImageUrl,
} from "../src/theme/brand-markup.js";

describe("sanitizeBrandImageUrl", () => {
  it("allows https and relative paths", () => {
    expect(sanitizeBrandImageUrl("https://x.com/a.png")).toBe("https://x.com/a.png");
    expect(sanitizeBrandImageUrl("/assets/logo.svg")).toBe("/assets/logo.svg");
  });

  it("rejects unsafe urls", () => {
    expect(sanitizeBrandImageUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeBrandImageUrl("data:text/html,foo")).toBeNull();
  });
});

describe("getHeaderLogoMarkup", () => {
  it("uses custom header logo when valid", () => {
    const html = getHeaderLogoMarkup({
      headerLogoUrl: "https://cdn.example.com/logo.png",
    });
    expect(html).toContain("<img");
    expect(html).toContain("logo.png");
  });
});
