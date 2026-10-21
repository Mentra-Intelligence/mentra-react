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
