/** @type {Partial<import('./types.js').EmbedChatConfig>} */
export const DEFAULT_CONFIG = {
  configSchemaVersion: 2,
  title: "ChatFast",
  subtitle: "",
  mode: "chat",
  provider: "ollama",
  placeholder: "Ask anything…",
  welcomeMessage: "auto",
  welcomeFollowUp: "How can I help you today?",
  starterPrompts: ["What can you do?", "Help me get started"],
  position: "bottom-right",
  theme: { appearance: "auto", showThemeToggle: true, launcherIcon: "chatfast" },
  auth: { type: "none" },
};
