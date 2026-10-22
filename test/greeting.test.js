import { describe, expect, it } from "vitest";
import { resolveWelcomeMessage, timeOfDayGreeting } from "../src/greeting.js";

describe("timeOfDayGreeting", () => {
  it("returns morning, afternoon, and evening", () => {
    expect(timeOfDayGreeting(new Date(2026, 0, 1, 8, 0))).toBe("Good morning");
    expect(timeOfDayGreeting(new Date(2026, 0, 1, 14, 0))).toBe("Good afternoon");
    expect(timeOfDayGreeting(new Date(2026, 0, 1, 19, 0))).toBe("Good evening");
    expect(timeOfDayGreeting(new Date(2026, 0, 1, 23, 0))).toBe("Good evening");
    expect(timeOfDayGreeting(new Date(2026, 0, 1, 3, 0))).toBe("Good evening");
  });
});

describe("resolveWelcomeMessage", () => {
  it("builds auto greeting with user name", () => {
    const text = resolveWelcomeMessage(
      { baseUrl: "", model: "", userName: "Rajiv", welcomeMessage: "auto" },
      new Date(2026, 0, 1, 9, 0)
    );
    expect(text).toBe("Good morning, Rajiv. How can I help you today?");
  });

  it("supports template tokens", () => {
    const text = resolveWelcomeMessage(
      {
        baseUrl: "",
        model: "",
        userName: "Rajiv",
        welcomeMessage: "{greeting}, {name}!",
      },
      new Date(2026, 0, 1, 9, 0)
    );
    expect(text).toBe("Good morning, Rajiv!");
  });

  it("returns empty when welcomeMessage is blank", () => {
    expect(
      resolveWelcomeMessage({
        baseUrl: "",
        model: "",
        welcomeMessage: "",
      })
    ).toBe("");
  });

  it("uses configurable welcomeFollowUp", () => {
    const text = resolveWelcomeMessage(
      {
        baseUrl: "",
        model: "",
        userName: "Rajiv",
        welcomeMessage: "auto",
        welcomeFollowUp: "What would you like to explore?",
      },
      new Date(2026, 0, 1, 9, 0)
    );
    expect(text).toBe("Good morning, Rajiv. What would you like to explore?");
  });

  it("omits follow-up when welcomeFollowUp is empty", () => {
    expect(
      resolveWelcomeMessage(
        {
          baseUrl: "",
          model: "",
          userName: "Rajiv",
          welcomeMessage: "auto",
          welcomeFollowUp: "",
        },
        new Date(2026, 0, 1, 9, 0)
      )
    ).toBe("Good morning, Rajiv.");
  });

  it("uses custom static welcome when not auto", () => {
    expect(
      resolveWelcomeMessage({
        baseUrl: "",
        model: "",
        welcomeMessage: "Hello there",
      })
    ).toBe("Hello there");
  });
});
