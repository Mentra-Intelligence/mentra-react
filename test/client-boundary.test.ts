import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// `MentraPage` must stay renderable from a React Server Component, so hooks
// live only in the one "use client" module (built as its own file).
describe("client boundary", () => {
  const dir = join(__dirname, "..", "src");
  const files = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(d, e.name)) : /\.tsx?$/.test(e.name) ? [join(d, e.name)] : []);

  it("uses React hooks only in src/page/motion.tsx, which starts with \"use client\"", () => {
    const withHooks = files(dir)
      .filter((f) => /\buse(State|Effect|LayoutEffect|Reducer|Ref|Context)\s*\(/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(dir.length + 1));
    expect(withHooks).toEqual(["page/motion.tsx"]);
    expect(readFileSync(join(dir, "page", "motion.tsx"), "utf8").startsWith('"use client";')).toBe(true);
  });
});
