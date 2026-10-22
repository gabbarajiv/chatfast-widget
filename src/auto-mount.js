import { readInlineEmbedConfig, mountOptionsFromScript } from "./embed-config.js";
import { mergeEmbedChatConfig } from "./load-config.js";

/** @typedef {import('./types.js').EmbedChatConfig & { target?: HTMLElement | string; useExistingElement?: boolean }} AutoMountOptions */

/**
 * Mount using inline page config (globals, JSON block, script data-* attributes).
 * @param {AutoMountOptions} [overrides]
 * @returns {import('./widget.js').ChatFastWidgetElement | null}
 */
export function createAutoMount(mountChatFast) {
  /**
   * @param {AutoMountOptions} [overrides]
   * @returns {import('./widget.js').ChatFastWidgetElement | null}
   */
  function autoMountChatFast(overrides = {}) {
    const { useExistingElement, target: targetOverride, ...rest } = overrides;
    const script =
      typeof document !== "undefined"
        ? /** @type {HTMLScriptElement | null} */ (document.currentScript)
        : null;

    const config = mergeEmbedChatConfig(readInlineEmbedConfig(script), rest);

    if (!config.baseUrl || !config.model) {
      console.warn(
        "[ChatFast] Embed config needs baseUrl and model (set window.ChatFastConfig or data-base-url / data-model on the loader script)."
      );
      return null;
    }

    let target = targetOverride;
    if (typeof target === "string" && typeof document !== "undefined") {
      target =
        /** @type {HTMLElement | null} */ (document.querySelector(target)) ??
        undefined;
    }

    if (
      useExistingElement !== false &&
      typeof document !== "undefined" &&
      !target
    ) {
      const existing = document.querySelector(
        "chatfast-widget:not([data-chatfast-mounted]), embed-chat-widget:not([data-chatfast-mounted])"
      );
      if (existing) {
        existing.setAttribute("data-chatfast-mounted", "true");
        /** @type {import('./widget.js').ChatFastWidgetElement} */ (
          existing
        ).setConfig(config);
        return /** @type {import('./widget.js').ChatFastWidgetElement} */ (
          existing
        );
      }
    }

    return mountChatFast({
      ...config,
      target: /** @type {HTMLElement | undefined} */ (target),
    });
  }

  /**
   * Run auto-mount for loader scripts marked with `data-chatfast-autoload`.
   * @param {typeof mountChatFast} mountFn
   */
  function runAutoMountFromPage(mountFn) {
    if (typeof document === "undefined") {
      return;
    }

    const run = () => {
      const scripts = document.querySelectorAll(
        "script[data-chatfast-autoload]"
      );
      for (const node of scripts) {
        const script = /** @type {HTMLScriptElement} */ (node);
        if (script.dataset.chatfastAutoloadDone === "true") {
          continue;
        }
        script.dataset.chatfastAutoloadDone = "true";

        const scriptOptions = mountOptionsFromScript(script);
        const config = readInlineEmbedConfig(script);
        const { useExistingElement, target: targetOverride } = scriptOptions;

        if (!config.baseUrl || !config.model) {
          console.warn(
            "[ChatFast] data-chatfast-autoload: missing baseUrl/model in embed config."
          );
          continue;
        }

        let target = targetOverride;
        if (typeof target === "string") {
          target =
            /** @type {HTMLElement | null} */ (
              document.querySelector(target)
            ) ?? undefined;
        }

        if (useExistingElement !== false && !target) {
          const existing = document.querySelector(
            "chatfast-widget:not([data-chatfast-mounted]), embed-chat-widget:not([data-chatfast-mounted])"
          );
          if (existing) {
            existing.setAttribute("data-chatfast-mounted", "true");
            /** @type {import('./widget.js').ChatFastWidgetElement} */ (
              existing
            ).setConfig(config);
            continue;
          }
        }

        mountFn({
          ...config,
          target: /** @type {HTMLElement | undefined} */ (target),
        });
      }
    };

    const current = /** @type {HTMLScriptElement | null} */ (
      document.currentScript
    );
    if (current?.hasAttribute("data-chatfast-autoload")) {
      run();
      return;
    }

    if (!document.querySelector("script[data-chatfast-autoload]")) {
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  }

  return { autoMountChatFast, runAutoMountFromPage };
}
