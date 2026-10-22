import { CHATFAST_MARK, CHATFAST_MARK_APP } from "../brand/mark.js";

/**
 * @param {string | undefined} raw
 * @returns {string | null}
 */
export function sanitizeBrandImageUrl(raw) {
  const url = raw?.trim();
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(url)) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return url;
    }
  } catch {
    /* invalid */
  }
  return null;
}

/**
 * @param {string} url
 * @param {string} [className]
 * @returns {string}
 */
export function brandImageTag(url, className = "cf-brand-img") {
  const safe = sanitizeBrandImageUrl(url);
  if (!safe) return "";
  const escaped = safe.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<img class="${className}" src="${escaped}" alt="" decoding="async" />`;
}

/**
 * @param {import('../types.js').WidgetTheme | undefined} theme
 * @returns {string}
 */
export function getHeaderLogoMarkup(theme) {
  const url = theme?.headerLogoUrl?.trim();
  if (url) {
    const img = brandImageTag(url, "cf-brand-img cf-header-logo-img");
    if (img) return img;
  }
  return CHATFAST_MARK_APP;
}

/**
 * @param {import('../types.js').WidgetTheme | undefined} theme
 * @returns {string}
 */
export function getAssistantAvatarMarkup(theme) {
  const url = theme?.headerLogoUrl?.trim();
  if (url) {
    const img = brandImageTag(url, "cf-brand-img cf-avatar-img");
    if (img) return img;
  }
  return CHATFAST_MARK;
}
