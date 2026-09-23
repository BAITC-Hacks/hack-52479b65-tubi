import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const css = readFileSync("src/shared/styles.css", "utf8");
function token(name: string) {
  const hex = css.match(new RegExp("--" + name + ": #(\\w{6})"))?.[1];
  if (!hex) throw new Error("Missing color token: " + name);
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
}
function luminance(color: number[]) {
  const [r, g, b] = color.map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(a: string, b: string) {
  const [lighter, darker] = [luminance(token(a)), luminance(token(b))].sort((a, b) => b - a);
  return (lighter + .05) / (darker + .05);
}
describe("business palette contrast", () => {
  it.each(["background", "surface", "subtle"])("has readable text on %s", (background) => {
    for (const foreground of ["ink", "muted", "accent"]) expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
  it("has readable primary buttons and visible field borders", () => {
    expect(contrast("surface", "accent")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("control-border", "surface")).toBeGreaterThanOrEqual(3);
  });
});
