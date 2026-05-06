import { describe, expect, it } from "vitest";
import { applyTemplate } from "../../src/domain/templates";

describe("applyTemplate", () => {
  it("replaces placeholders", () => {
    const t = applyTemplate("Hi {{ name }} from {{company}}.", {
      name: "Ada",
      company: "Acme",
    });
    expect(t).toBe("Hi Ada from Acme.");
  });
});
