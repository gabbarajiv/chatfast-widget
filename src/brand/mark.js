/** Chat bubble + lightning bolt — fast chat at a glance. */

const STROKE =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const BUBBLE_PATH =
  "M7.5 5.75h9a2.25 2.25 0 0 1 2.25 2.25v4.25A2.25 2.25 0 0 1 16.5 14.45h-3.35L9.75 17.5v-3.05H7.5a2.25 2.25 0 0 1-2.25-2.25V8a2.25 2.25 0 0 1 2.25-2.25z";

const BOLT_PATH = "M12.35 8.15 9.4 13.35h2.35l-.9 4.35 4.15-5.35H12.6V8.15z";

const APP_BG = "#0f172a";
const APP_STROKE = "#fff";

/** Launcher, assistant avatar (white on brand color) */
export const CHATFAST_MARK = `<svg viewBox="0 0 24 24" ${STROKE} aria-hidden="true"><path d="${BUBBLE_PATH}"/><path d="${BOLT_PATH}"/></svg>`;

/** Header tile + favicon */
export const CHATFAST_MARK_APP = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="8" fill="${APP_BG}"/><path d="M9.5 7.5h11.25a2.75 2.75 0 0 1 2.75 2.75v5.25A2.75 2.75 0 0 1 20.5 18.25h-4.05L12.25 22v-3.75H9.5a2.75 2.75 0 0 1-2.75-2.75v-5.25A2.75 2.75 0 0 1 9.5 7.5z" stroke="${APP_STROKE}" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.25 10.75 12.15 17.25h3.05l-1.2 5.05 5.35-6.85H17.1v-4.7z" stroke="${APP_STROKE}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
