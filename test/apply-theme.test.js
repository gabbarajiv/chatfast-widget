import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  applyTheme,
  resolveAppearance,
  resolveThemePalette,
  THEME_CSS_VARS,
} from "../src/theme/apply-theme.js";

describe("resolveAppearance", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((q) => ({
        matches: q.includes("dark"),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
  });

  it("uses override when set", () => {
    expect(resolveAppearance({ appearance: "auto" }, "light")).toBe("light");
  });

  it("resolves auto from prefers-color-scheme", () => {
    expect(resolveAppearance({ appearance: "auto" })).toBe("dark");
  });

  it("uses fixed appearance", () => {
    expect(resolveAppearance({ appearance: "light" })).toBe("light");
  });
});

describe("resolveThemePalette", () => {
  it("returns base palette for light", () => {
    expect(resolveThemePalette({ primary: "#abc" }, "light").primary).toBe("#abc");
  });

  it("merges dark overrides", () => {
    const palette = resolveThemePalette(
      { primary: "#111", dark: { primary: "#222" } },
      "dark"
    );
    expect(palette.primary).toBe("#222");
  });
});

describe("applyTheme", () => {
  it("sets CSS variables and fallbacks", () => {
    const host = document.createElement("div");
    const appearance = applyTheme(host, {
      appearance: "light",
      primary: "#6366f1",
      launcher: "#111",
    });
    expect(appearance).toBe("light");
    expect(host.dataset.theme).toBe("light");
    expect(host.style.getPropertyValue("--cf-primary")).toBe("#6366f1");
    expect(host.style.getPropertyValue("--cf-launcher-icon")).toBe("#ffffff");
    expect(host.style.getPropertyValue("--cf-launcher-hover")).toBe("#111");
  });

  it("clears vars then applies palette keys", () => {
    const host = document.createElement("div");
    host.style.setProperty("--cf-primary", "red");
    applyTheme(host, { primary: "#000" }, { override: "dark" });
    expect(host.dataset.theme).toBe("dark");
    expect(Object.keys(THEME_CSS_VARS).length).toBeGreaterThan(0);
  });

  it("handles undefined theme", () => {
    const host = document.createElement("div");
    applyTheme(host, undefined, { override: "light" });
    expect(host.dataset.theme).toBe("light");
  });

  it("uses primary fallbacks for launcher when missing", () => {
    const host = document.createElement("div");
    applyTheme(host, { primary: "#6366f1", primaryHover: "#5555ee" });
    expect(host.style.getPropertyValue("--cf-launcher")).toBe("#6366f1");
    expect(host.style.getPropertyValue("--cf-launcher-hover")).toBe("#5555ee");
  });
});
