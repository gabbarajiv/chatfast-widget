import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/config-defaults.js";
import { CHATFAST_MARK, CHATFAST_MARK_APP } from "../src/brand/mark.js";
import * as composerIcons from "../src/theme/composer-icons.js";
import {
  ChatFastWidgetElement,
  EmbedChatWidgetElement,
} from "../src/widget.js";

describe("static modules", () => {
  it("exports defaults and brand marks", () => {
    expect(DEFAULT_CONFIG.provider).toBe("ollama");
    expect(CHATFAST_MARK).toContain("<svg");
    expect(CHATFAST_MARK_APP).toContain("#0f172a");
    expect(CHATFAST_MARK).toContain("12.35 8.15");
  });

  it("exports composer icons", () => {
    expect(composerIcons.ICON_SEND).toContain("<svg");
    expect(composerIcons.ICON_SPARK).toBe(composerIcons.ICON_BOT);
  });

  it("keeps legacy element alias", () => {
    expect(EmbedChatWidgetElement.prototype).toBeInstanceOf(
      ChatFastWidgetElement
    );
  });
});
