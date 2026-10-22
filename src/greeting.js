import { DEFAULT_CONFIG } from "./config-defaults.js";

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function timeOfDayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good evening";
}

/**
 * @param {import('./types.js').EmbedChatConfig} config
 * @param {Date} [now]
 * @returns {string}
 */
/**
 * @param {import('./types.js').EmbedChatConfig} config
 * @returns {string}
 */
function resolveWelcomeFollowUp(config) {
  if (config.welcomeFollowUp === "") return "";
  const text = config.welcomeFollowUp ?? DEFAULT_CONFIG.welcomeFollowUp ?? "";
  return text.trim();
}

/**
 * @param {string} greeting
 * @param {string} name
 * @param {string} followUp
 */
function formatAutoWelcome(greeting, name, followUp) {
  if (name) {
    const lead = `${greeting}, ${name}.`;
    return followUp ? `${lead} ${followUp}` : lead;
  }
  const lead = `${greeting}!`;
  return followUp ? `${lead} ${followUp}` : lead;
}

export function resolveWelcomeMessage(config, now = new Date()) {
  if (config.welcomeMessage === "") return "";
  const raw = config.welcomeMessage ?? DEFAULT_CONFIG.welcomeMessage ?? "auto";
  const name = config.userName?.trim();
  const greeting = timeOfDayGreeting(now);
  const followUp = resolveWelcomeFollowUp(config);

  if (raw === "auto") {
    return formatAutoWelcome(greeting, name, followUp);
  }

  if (!raw) {
    return formatAutoWelcome(greeting, name, followUp);
  }

  return raw
    .replaceAll("{greeting}", greeting)
    .replaceAll("{name}", name ?? "")
    .replaceAll("{followUp}", followUp)
    .replace(/\s{2,}/g, " ")
    .trim();
}
