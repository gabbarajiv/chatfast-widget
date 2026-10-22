/**
 * @typedef {'chat' | 'completions'} ChatMode
 * @typedef {'ollama' | 'openai-compatible'} ProviderKind
 * @typedef {'user' | 'assistant' | 'system'} MessageRole
 * @typedef {'light' | 'dark' | 'auto'} ThemeAppearance
 * @typedef {'chat' | 'help' | 'support' | 'bot'} LauncherIconId
 * @typedef {'none' | 'session-storage' | 'auth-url'} EmbedChatAuthType
 *
 * @typedef {Object} EmbedChatAuth
 * @property {EmbedChatAuthType} type How the widget obtains a bearer token for the ChatFast backend.
 * @property {string} [sessionStorageKey] sessionStorage key when type is `session-storage` (e.g. access token from the host app).
 * @property {string} [authUrl] Token or session endpoint when type is `auth-url`.
 *
 * @typedef {Object} ChatMessageImage
 * @property {string} mimeType
 * @property {string} data Base64-encoded image bytes (no data-URL prefix).
 *
 * @typedef {Object} ChatMessage
 * @property {MessageRole} role
 * @property {string} content
 * @property {ChatMessageImage[]} [images]
 *
 * @typedef {Object} WidgetTheme
 * @property {ThemeAppearance} [appearance]
 * @property {string} [primary]
 * @property {string} [primaryHover]
 * @property {string} [surface]
 * @property {string} [surfaceElevated]
 * @property {string} [border]
 * @property {string} [text]
 * @property {string} [muted]
 * @property {string} [userBubble]
 * @property {string} [assistantBubble]
 * @property {string} [radius]
 * @property {string} [fontFamily]
 * @property {string} [shadow]
 * @property {string} [header]
 * @property {string} [headerText]
 * @property {string} [headerMuted]
 * @property {string} [headerBorder]
 * @property {string} [headerActionHover]
 * @property {string} [composer]
 * @property {string} [launcher]
 * @property {string} [launcherHover]
 * @property {string} [launcherIconColor]
 * @property {LauncherIconId} [launcherIcon]
 * @property {string} [launcherIconUrl] PNG/SVG/WebP URL or data URL for the floating launcher button.
 * @property {string} [launcherIconSvg]
 * @property {string} [headerLogoUrl] PNG/SVG/WebP URL or data URL for the chat header (and assistant avatar).
 * @property {boolean} [showThemeToggle]
 * @property {Partial<Omit<WidgetTheme, 'dark' | 'appearance' | 'showThemeToggle' | 'launcherIcon' | 'launcherIconSvg'>>} [dark]
 *
 * @typedef {Object} EmbedChatConfig
 * @property {number} [configSchemaVersion]
 * @property {string} baseUrl
 * @property {string} model
 * @property {string} [title]
 * @property {string} [subtitle]
 * @property {ChatMode} [mode]
 * @property {ProviderKind} [provider]
 * @property {string} [apiKey]
 * @property {string} [systemPrompt]
 * @property {string} [userName] Visitor display name for personalized greetings.
 * @property {string} [welcomeMessage] Set to `auto` for time-of-day greeting; `{greeting}` / `{name}` / `{followUp}` tokens supported.
 * @property {string} [welcomeFollowUp] Second sentence after auto greeting (empty to omit).
 * @property {string[]} [starterPrompts]
 * @property {string} [placeholder]
 * @property {'bottom-right' | 'bottom-left'} [position]
 * @property {'floating' | 'inline'} [layout]
 * @property {number} [panelWidth]
 * @property {number} [panelHeight]
 * @property {WidgetTheme} [theme]
 * @property {{ attachments?: boolean; voiceInput?: boolean }} [features]
 * @property {EmbedChatAuth} [auth] Visitor/session token source for backend-proxied chat (Phase 2+).
 * @property {AbortSignal} [signal]
 */

export {};
