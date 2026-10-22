import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MentraContent, type TipTapNode } from "../src";

const html = (content: TipTapNode[]) =>
  renderToStaticMarkup(<MentraContent doc={{ type: "doc", content }} />);
const text = (t: string): TipTapNode => ({ type: "text", text: t });
const cell = (type: "tableHeader" | "tableCell", t: string): TipTapNode => ({
  type,
  content: [{ type: "paragraph", content: [text(t)] }],
});
const embed = (url: unknown): TipTapNode => ({ type: "embed", attrs: { url } });

const SANDBOX = 'sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"';

describe("table", () => {
  it("puts leading header rows in thead and the rest in tbody", () => {
    const out = html([
      {
        type: "table",
        content: [
          { type: "tableRow", content: [cell("tableHeader", "Plan"), cell("tableHeader", "Price")] },
          { type: "tableRow", content: [cell("tableCell", "Pro"), cell("tableCell", "10")] },
        ],
      },
    ]);
    expect(out).toBe(
      "<table><thead><tr><th><p>Plan</p></th><th><p>Price</p></th></tr></thead>" +
        "<tbody><tr><td><p>Pro</p></td><td><p>10</p></td></tr></tbody></table>",
    );
  });

  it("has no thead without a header row", () => {
    const out = html([{ type: "table", content: [{ type: "tableRow", content: [cell("tableCell", "a")] }] }]);
    expect(out).toBe("<table><tbody><tr><td><p>a</p></td></tr></tbody></table>");
  });
});

describe("embed", () => {
  it("frames an allowlisted YouTube URL from the parsed id, sandboxed", () => {
    const out = html([embed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x")]);
    expect(out).toContain('<figure data-embed="youtube"><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(out).toContain(SANDBOX);
    expect(out).toContain('allow="encrypted-media; picture-in-picture; fullscreen"');
    expect(out).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(out).not.toContain("list=x");
  });

  it("frames Loom and Vimeo share links", () => {
    const loom = html([embed("https://www.loom.com/share/0123456789abcdef0123456789abcdef")]);
    expect(loom).toContain('src="https://www.loom.com/embed/0123456789abcdef0123456789abcdef"');
    expect(loom).toContain(SANDBOX);
    expect(html([embed("https://vimeo.com/76979871")])).toContain(
      'src="https://player.vimeo.com/video/76979871?dnt=1"',
    );
  });

  it("renders an off-list https URL as a link, never an iframe", () => {
    const out = html([embed("https://evil.example/embed/x")]);
    expect(out).not.toContain("<iframe");
    expect(out).toBe('<p><a href="https://evil.example/embed/x" rel="noopener noreferrer">https://evil.example/embed/x</a></p>');
  });

  it.each([
    ["javascript", "javascript:alert(1)"],
    ["http", "http://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["lookalike host", "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ"],
    ["credentials", "https://user@www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["quote break-out", 'https://www.youtube.com/watch?v=dQw4w9WgXcQ"onload="x'],
  ])("does not frame a %s URL", (_, url) => {
    expect(html([embed(url)])).not.toContain("<iframe");
  });

  it.each([["javascript:alert(1)"], [""], [undefined], [42]])("renders nothing for %s", (url) => {
    expect(html([embed(url)])).toBe("");
  });
});

describe("article blocks", () => {
  const para = (t: string): TipTapNode => ({ type: "paragraph", content: [text(t)] });

  it.each(["note", "tip", "warning", "info"])("renders a %s callout", (variant) => {
    expect(html([{ type: "callout", attrs: { variant }, content: [para("Hi")] }])).toBe(
      `<aside data-callout="${variant}"><p>Hi</p></aside>`,
    );
  });

  it.each([["danger"], [undefined], [42]])("falls back to a note callout for %s", (variant) => {
    expect(html([{ type: "callout", attrs: { variant }, content: [para("Hi")] }])).toBe(
      '<aside data-callout="note"><p>Hi</p></aside>',
    );
  });

  it("renders key takeaways with a title", () => {
    const list: TipTapNode = { type: "bulletList", content: [{ type: "listItem", content: [para("One")] }] };
    expect(html([{ type: "keyTakeaways", attrs: { title: " Summary " }, content: [list] }])).toBe(
      '<section data-key-takeaways=""><h2>Summary</h2><ul><li><p>One</p></li></ul></section>',
    );
  });

  it("renders key takeaways without a title", () => {
    expect(html([{ type: "keyTakeaways", attrs: { title: "  " }, content: [para("One")] }])).toBe(
      '<section data-key-takeaways=""><p>One</p></section>',
    );
  });

  const quote = (attrs: Record<string, unknown>): TipTapNode => ({
    type: "pullQuote",
    attrs,
    content: [text("Words")],
  });

  it("renders a pull quote with no attribution", () => {
    expect(html([quote({})])).toBe("<figure><blockquote><p>Words</p></blockquote></figure>");
  });

  it("renders a plain-text attribution", () => {
    expect(html([quote({ attribution: "Ada" })])).toBe(
      "<figure><blockquote><p>Words</p></blockquote><figcaption>Ada</figcaption></figure>",
    );
  });

  it("links the attribution to a safe source URL", () => {
    expect(html([quote({ attribution: "Ada", sourceUrl: "https://example.com/a" })])).toBe(
      '<figure><blockquote cite="https://example.com/a"><p>Words</p></blockquote>' +
        '<figcaption><a href="https://example.com/a" rel="noopener noreferrer">Ada</a></figcaption></figure>',
    );
  });

  it("drops an unsafe source URL", () => {
    const out = html([quote({ attribution: "Ada", sourceUrl: "javascript:alert(1)" })]);
    expect(out).not.toContain("javascript");
    expect(out).toBe("<figure><blockquote><p>Words</p></blockquote><figcaption>Ada</figcaption></figure>");
  });
});
