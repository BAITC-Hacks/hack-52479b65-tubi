import { describe, expect, it } from "vitest";
import { getNextImprovement } from "./ratingAdvice";

describe("rating advice", () => {
  it("takes the remaining points from the server, including partially completed groups", () => {
    expect(getNextImprovement({
      score: 10, level: "draft",
      breakdown: [{ key: "context", earned: 10, max: 24 }],
      improvements: [{ fields: ["need"], message: "Fill need" }],
    })?.remaining).toBe(14);
  });
  it("does not double count grouped fields or invent missing weights", () => {
    expect(getNextImprovement({
      score: 0, level: "draft",
      breakdown: [{ key: "communication", earned: 3, max: 12 }],
      improvements: [{ fields: ["contact", "interaction_format"], message: "Contact" }],
    })?.remaining).toBe(9);
    expect(getNextImprovement({ score: 0, level: "draft", breakdown: [],
      improvements: [{ fields: ["title"], message: "Title" }],
    })?.remaining).toBe(0);
  });
});
