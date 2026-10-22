import DOMPurify from "dompurify";
import { CHATFAST_MARK } from "../brand/mark.js";
import { brandImageTag } from "./brand-markup.js";

/** @type {Record<string, string>} */
export const LAUNCHER_ICONS = {
  chatfast: CHATFAST_MARK,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  support: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/><path d="M21 16v2a4 4 0 0 1-4 4h-1"/></svg>`,
  bot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>`,
};

/** @typedef {keyof typeof LAUNCHER_ICONS | string} LauncherIconId */

/**
 * @param {import('../types.js').WidgetTheme | undefined} theme
 * @returns {string}
 */
export function getLauncherIconMarkup(theme) {
  const iconUrl = theme?.launcherIconUrl?.trim();
  if (iconUrl) {
    const img = brandImageTag(iconUrl, "cf-brand-img cf-launcher-icon-img");
    if (img) return img;
  }
  const custom = theme?.launcherIconSvg?.trim();
  if (custom) {
    return DOMPurify.sanitize(custom, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ["svg", "path", "circle", "rect", "line", "polyline", "polygon"],
      ADD_ATTR: ["viewBox", "fill", "stroke", "stroke-width", "d", "cx", "cy", "r", "x", "y", "width", "height", "aria-hidden"],
    });
  }
  const id = theme?.launcherIcon ?? "chatfast";
  return LAUNCHER_ICONS[id] ?? LAUNCHER_ICONS.chat;
}

export const THEME_TOGGLE_SUN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;

export const THEME_TOGGLE_MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
