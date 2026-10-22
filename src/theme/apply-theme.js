/** Maps EmbedChatConfig.theme keys to CSS custom properties on the host. */
export const THEME_CSS_VARS = {
  primary: "--cf-primary",
  primaryHover: "--cf-primary-hover",
  surface: "--cf-surface",
  surfaceElevated: "--cf-surface-elevated",
  border: "--cf-border",
  text: "--cf-text",
  muted: "--cf-muted",
  userBubble: "--cf-user",
  assistantBubble: "--cf-assistant",
  radius: "--cf-radius",
  fontFamily: "--cf-font",
  header: "--cf-header",
  headerText: "--cf-header-text",
  headerMuted: "--cf-header-muted",
  headerBorder: "--cf-header-border",
  headerActionHover: "--cf-header-action-hover",
  composer: "--cf-composer",
  launcher: "--cf-launcher",
  launcherHover: "--cf-launcher-hover",
  launcherIconColor: "--cf-launcher-icon",
  shadow: "--cf-shadow",
};

/** @typedef {'light' | 'dark'} ResolvedAppearance */

/**
 * @param {import('../types.js').WidgetTheme | undefined} theme
 * @param {ResolvedAppearance | null} [override]
 * @returns {ResolvedAppearance}
 */
export function resolveAppearance(theme, override = null) {
  if (override) {
    return override;
  }
  const appearance = theme?.appearance ?? "auto";
  if (appearance === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return appearance;
}

/**
 * @param {import('../types.js').WidgetTheme | undefined} theme
 * @param {ResolvedAppearance} appearance
 */
export function resolveThemePalette(theme, appearance) {
  const base = theme ?? {};
  if (appearance !== "dark") {
    return base;
  }
  const dark = base.dark ?? {};
  /** @type {import('../types.js').WidgetTheme} */
  const merged = { ...base };
  for (const key of Object.keys(THEME_CSS_VARS)) {
    if (dark[/** @type {keyof typeof THEME_CSS_VARS} */ (key)]) {
      merged[/** @type {keyof typeof THEME_CSS_VARS} */ (key)] =
        dark[/** @type {keyof typeof THEME_CSS_VARS} */ (key)];
    }
  }
  return merged;
}

/**
 * @param {HTMLElement} host
 * @param {import('../types.js').WidgetTheme | undefined} theme
 * @param {{ override?: ResolvedAppearance | null }} [options]
 * @returns {ResolvedAppearance}
 */
export function applyTheme(host, theme, options = {}) {
  const appearance = resolveAppearance(theme, options.override ?? null);
  host.dataset.theme = appearance;

  for (const cssVar of Object.values(THEME_CSS_VARS)) {
    host.style.removeProperty(cssVar);
  }

  const palette = resolveThemePalette(theme, appearance);

  for (const [key, cssVar] of Object.entries(THEME_CSS_VARS)) {
    const val = palette[/** @type {keyof typeof THEME_CSS_VARS} */ (key)];
    if (val) {
      host.style.setProperty(cssVar, val);
    }
  }

  if (palette.primary && !palette.primaryHover) {
    host.style.setProperty("--cf-primary-hover", palette.primary);
  }
  if (palette.primary && !palette.launcher) {
    host.style.setProperty("--cf-launcher", palette.primary);
  }
  if (palette.launcher && !palette.launcherHover) {
    host.style.setProperty("--cf-launcher-hover", palette.launcher);
  } else if (palette.primary && !palette.launcherHover) {
    host.style.setProperty(
      "--cf-launcher-hover",
      palette.primaryHover ?? palette.primary
    );
  }
  if (!palette.launcherIconColor) {
    host.style.setProperty("--cf-launcher-icon", "#ffffff");
  }

  return appearance;
}
