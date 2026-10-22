import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MentraContent, type TipTapNode } from "../src";

const para = (text: string, marks: TipTapNode["marks"]): TipTapNode => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text, marks }] }],
});
const html = (doc: TipTapNode, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<MentraContent doc={doc} {...props} />);

const internal = para("pricing guide", [
  { type: "link", attrs: { href: "/pricing-guide", contentId: "abc123", slug: "pricing-guide", target: null } },
]);

describe("links", () => {
  it("renders an external link in a new tab, as before", () => {
    const out = html(para("site", [{ type: "link", attrs: { href: "https://example.com" } }]));
    expect(out).toBe('<p><a href="https://example.com" target="_blank">site</a></p>');
  });

  it("renders an internal link at its href, in the same tab", () => {
    expect(html(internal)).toBe('<p><a href="/pricing-guide">pricing guide</a></p>');
  });

  it("maps an internal link to the site's own route", () => {
    const seen: unknown[] = [];
    const out = html(internal, {
      resolveInternalLink: (link: unknown) => {
        seen.push(link);
        return "/blog/pricing-guide";
      },
    });
    expect(out).toBe('<p><a href="/blog/pricing-guide">pricing guide</a></p>');
    expect(seen).toEqual([{ contentId: "abc123", slug: "pricing-guide", href: "/pricing-guide" }]);
  });

  it("renders the text alone when the resolver returns nothing", () => {
    expect(html(internal, { resolveInternalLink: () => undefined })).toBe("<p>pricing guide</p>");
  });

  it("lets a link override take over internal links too", () => {
    const out = html(internal, {
      markOverrides: { link: ({ children }: { children: unknown }) => <span>{children as string}</span> },
    });
    expect(out).toBe("<p><span>pricing guide</span></p>");
  });
});

describe("image alt text", () => {
  const image = (attrs: Record<string, unknown>): TipTapNode => ({
    type: "doc",
    content: [{ type: "image", attrs: { src: "https://cdn.test/a.png", ...attrs } }],
  });

  it("uses the alt text, not the caption, when both are set", () => {
    const out = html(image({ alt: "A bar chart", caption: "Q3 revenue" }));
    expect(out).toContain('alt="A bar chart"');
    expect(out).toContain("<figcaption>Q3 revenue</figcaption>");
  });

  it("falls back to the caption when there is no alt text", () => {
    expect(html(image({ alt: "", caption: "Q3 revenue" }))).toContain('alt="Q3 revenue"');
    expect(html(image({ caption: "Q3 revenue" }))).toContain('alt="Q3 revenue"');
  });

  it("renders an empty alt when there is neither", () => {
    expect(html(image({}))).toContain('alt=""');
  });
});

const renderContent = (content: TipTapNode[]) =>
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
    const out = renderContent([
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
    const out = renderContent([{ type: "table", content: [{ type: "tableRow", content: [cell("tableCell", "a")] }] }]);
    expect(out).toBe("<table><tbody><tr><td><p>a</p></td></tr></tbody></table>");
  });
});

describe("embed", () => {
  it("frames an allowlisted YouTube URL from the parsed id, sandboxed", () => {
    const out = renderContent([embed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x")]);
    expect(out).toContain('<figure data-embed="youtube"><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(out).toContain(SANDBOX);
    expect(out).toContain('allow="encrypted-media; picture-in-picture; fullscreen"');
    expect(out).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(out).not.toContain("list=x");
  });

  it("frames Loom and Vimeo share links", () => {
    const loom = renderContent([embed("https://www.loom.com/share/0123456789abcdef0123456789abcdef")]);
    expect(loom).toContain('src="https://www.loom.com/embed/0123456789abcdef0123456789abcdef"');
    expect(loom).toContain(SANDBOX);
    expect(renderContent([embed("https://vimeo.com/76979871")])).toContain(
      'src="https://player.vimeo.com/video/76979871?dnt=1"',
    );
  });

  it("renders an off-list https URL as a link, never an iframe", () => {
    const out = renderContent([embed("https://evil.example/embed/x")]);
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
    expect(renderContent([embed(url)])).not.toContain("<iframe");
  });

  it.each([["javascript:alert(1)"], [""], [undefined], [42]])("renders nothing for %s", (url) => {
    expect(renderContent([embed(url)])).toBe("");
  });
});
