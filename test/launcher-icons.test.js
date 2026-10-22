import { describe, expect, it } from "vitest";
import {
  getLauncherIconMarkup,
  LAUNCHER_ICONS,
} from "../src/theme/launcher-icons.js";

describe("getLauncherIconMarkup", () => {
  it("defaults to chatfast icon", () => {
    expect(getLauncherIconMarkup(undefined)).toBe(LAUNCHER_ICONS.chatfast);
  });

  it("returns preset icons", () => {
    expect(getLauncherIconMarkup({ launcherIcon: "help" })).toBe(
      LAUNCHER_ICONS.help
    );
    expect(getLauncherIconMarkup({ launcherIcon: "unknown" })).toBe(
      LAUNCHER_ICONS.chat
    );
  });

  it("sanitizes custom svg", () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    expect(getLauncherIconMarkup({ launcherIconSvg: svg })).toContain("<svg");
  });

  it("prefers launcher icon url over presets", () => {
    const markup = getLauncherIconMarkup({
      launcherIcon: "help",
      launcherIconUrl: "https://cdn.example.com/icon.png",
    });
    expect(markup).toContain("<img");
    expect(markup).toContain("https://cdn.example.com/icon.png");
  });
});
