import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useState } from "react";
import {
  MentraPage, defaultBlocks, safeHref, themeToCssVars,
  type BlockComponent, type BlockOverrides, type PageBlock, type PageResponse,
} from "../src";

const page = (blocks: unknown[], extra: Partial<PageResponse> = {}): PageResponse => ({
  id: "p1", slug: "home", blocks: blocks as PageBlock[], jsonLd: [], ...extra,
});
const block = (type: string, content: unknown, extra: Partial<PageBlock> = {}): PageBlock =>
  ({ id: `b-${type}`, type, content, ...extra }) as PageBlock;
const html = (p: PageResponse, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<MentraPage page={p} {...props} />);

const ext = (url: string) => ({ type: "external", url });

/** `resolved` as `/v1/pages` returns it for a YouTube URL (`backend/app/libs/page_block_media.py`). */
const YT = {
  provider: "youtube",
  embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  sandbox: "allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox",
  allow: "encrypted-media; picture-in-picture; fullscreen",
  referrerPolicy: "strict-origin-when-cross-origin",
};
const MP4 = { provider: "file", fileUrl: "https://cdn.test/clip.mp4" };

/** One valid block of every contract type, with its expected default output. */
const SAMPLES: Record<string, { block: PageBlock; expect: string }> = {
  hero: { block: block("hero", { heading: "Welcome", subheading: "Sub", ctaText: "Go", ctaLink: ext("https://x.test") }), expect: "<h1>Welcome</h1>" },
  dynamic_hero: { block: block("dynamic_hero", { heading: "Big", primaryCtaText: "Start", primaryCtaLink: ext("/start") }), expect: "<h1>Big</h1>" },
  rich_text: { block: block("rich_text", { html: "<p>Hello <b>world</b></p>" }), expect: "Hello world" },
  image: { block: block("image", { url: "https://cdn.test/a.png", alt: "A" }), expect: 'src="https://cdn.test/a.png"' },
  video: { block: block("video", { url: "https://cdn.test/clip.mp4" }, { resolved: MP4 }), expect: '<video src="https://cdn.test/clip.mp4"' },
  embed: { block: block("embed", { url: "https://youtu.be/dQw4w9WgXcQ" }, { resolved: YT }), expect: `src="${YT.embedUrl}"` },
  features_grid: { block: block("features_grid", { title: "F", features: [{ title: "Fast" }] }), expect: "<h3>Fast</h3>" },
  testimonials: { block: block("testimonials", { items: [{ quote: "Great", name: "Kim", role: "CEO" }] }), expect: "Kim, CEO" },
  faq: { block: block("faq", { items: [{ question: "Why?", answer: "Because." }] }), expect: "<summary>Why?</summary>" },
  pricing: { block: block("pricing", { items: [{ name: "Pro", price: "$9", features: ["A"], popular: true }] }), expect: 'data-popular="true"' },
  cta: { block: block("cta", { heading: "Join", buttonText: "Sign up", buttonLink: ext("https://x.test/s") }), expect: 'href="https://x.test/s"' },
  columns: { block: block("columns", { layout: "1-2", columns: [{ id: "c1", blocks: [block("hero", { heading: "Nested" })] }] }), expect: "<h1>Nested</h1>" },
  dynamic_content: { block: block("dynamic_content", { title: "Latest" }, { resolved: { items: [{ id: "s1", title: "Post one", summary: "Sum" }] } }), expect: "Post one" },
  content_body: { block: block("content_body", { sourceType: "specific", contentId: "s1" }, { resolved: { item: { id: "s1", contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Body text" }] }] } } } }), expect: "<p>Body text</p>" },
  meta_info: { block: block("meta_info", { showAuthor: true }), expect: "" },
  context_navigation: { block: block("context_navigation", { showNext: true }), expect: "" },
  related_content: { block: block("related_content", { title: "Related" }, { resolved: { items: [{ id: "s2", title: "Other post" }] } }), expect: "Other post" },
};

describe("MentraPage", () => {
  it("has a default and a sample for every contract type", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(defaultBlocks).sort());
  });

  for (const [type, { block: b, expect: snippet }] of Object.entries(SAMPLES)) {
    it(`renders the default ${type}`, () => {
      const out = html(page([b]));
      if (snippet) expect(out).toContain(snippet);
    });

    it(`lets a site override ${type}`, () => {
      const Custom: BlockComponent = ({ block }) => <p data-custom={block.type}>mine</p>;
      const out = html(page([b]), { blocks: { [type]: Custom }, renderContextBound: true });
      expect(out).toContain(`data-custom="${type}"`);
    });
  }

  it("renders an override that uses hooks", () => {
    const Hooked: BlockComponent = ({ content }) => {
      const [n] = useState(3);
      return <b>{String(content.heading)}-{n}</b>;
    };
    expect(html(page([SAMPLES.hero.block]), { blocks: { hero: Hooked } })).toContain("<b>Welcome-3</b>");
  });

  it("can hide a type with null", () => {
    expect(html(page([SAMPLES.hero.block]), { blocks: { hero: null } })).not.toContain("Welcome");
  });

  it("skips unknown types without throwing, and renders the rest", () => {
    const out = html(page([block("carousel", { x: 1 }), block("__proto__", {}), block("toString", {}), SAMPLES.hero.block]));
    expect(out).toContain("<h1>Welcome</h1>");
    expect(out).not.toContain("carousel");
  });

  it("renders a new type when the site supplies a component for it", () => {
    const Carousel: BlockComponent = () => <div>slides</div>;
    expect(html(page([block("carousel", {})]), { blocks: { carousel: Carousel } })).toContain("slides");
  });

  it("survives malformed blocks and content", () => {
    const out = html(page([null, 7, "x", { id: "n" }, block("hero", null), block("faq", { items: "nope" }), block("columns", { columns: null })]));
    expect(out).toBe('<div class="mentra-page"></div>');
    expect(() => html({ id: "p", slug: "s" } as PageResponse)).not.toThrow();
  });

  it("skips null list entries", () => {
    const out = html(page([block("faq", { items: [null, { question: "Q", answer: "A" }, null] })]));
    expect(out.match(/<details>/g)).toHaveLength(1);
  });

  it("renders nothing for a block missing required fields", () => {
    expect(html(page([block("cta", { heading: "Join" })]))).toBe('<div class="mentra-page"></div>');
  });

  it("skips context-bound blocks unless asked", () => {
    const bound = block("hero", { heading: "Bound" }, { contextBound: true });
    expect(html(page([bound]))).not.toContain("Bound");
    expect(html(page([bound]), { renderContextBound: true })).toContain("Bound");
  });

  it("still renders a context-bound columns block, judging each child", () => {
    const cols = block("columns", { columns: [{ blocks: [
      block("hero", { heading: "Free" }),
      block("hero", { heading: "Bound child" }, { contextBound: true }),
    ] }] }, { contextBound: true, dynamicMappings: { x: "y" } });
    const out = html(page([cols]));
    expect(out).toContain("Free");
    expect(out).not.toContain("Bound child");
  });

  it("renders JSON-LD with < escaped, and can opt out", () => {
    const ld = [{ "@context": "https://schema.org", "@type": "FAQPage", name: "</script><script>alert(1)</script>" }];
    const out = html(page([], { jsonLd: ld }));
    expect(out).toContain('<script type="application/ld+json">');
    expect(out).not.toContain("</script><script>");
    expect(JSON.parse(out.match(/ld\+json">(.*?)<\/script>/)[1])).toEqual(ld[0]);
    expect(html(page([], { jsonLd: ld }), { jsonLd: false })).not.toContain("ld+json");
  });

  it("drops unsafe link and image URLs", () => {
    const out = html(page([
      block("cta", { heading: "H", buttonText: "Click", buttonLink: ext("javascript:alert(1)") }),
      block("hero", { heading: "H2", ctaText: "Go", ctaLink: ext(" java\tscript:alert(1)") }),
      block("image", { url: "javascript:alert(1)" }),
    ]));
    expect(out).not.toContain("javascript");
    expect(out).not.toContain("href");
    expect(out).toContain("Click");
  });

  it("renders internal links as text by default and via resolveLink when given", () => {
    const b = block("cta", { heading: "H", buttonText: "Go", buttonLink: { type: "internal", targetType: "page", targetId: "abc" } });
    expect(html(page([b]))).not.toContain("href");
    const out = html(page([b]), { resolveLink: (l: { targetId?: string }) => `/p/${l?.targetId}` });
    expect(out).toContain('href="/p/abc"');
  });

  it("adds target and rel for openInNewTab", () => {
    const out = html(page([block("cta", { heading: "H", buttonText: "Go", buttonLink: { ...ext("https://x.test"), openInNewTab: true } })]));
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("never injects rich_text HTML without a sanitiser", () => {
    const out = html(page([block("rich_text", { html: "<p>Hi</p><script>x()</script><img src=x onerror=y()>" })]));
    expect(out).toContain("<p>Hi</p>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
  });

  it("injects sanitised rich_text HTML when a sanitiser is given", () => {
    const out = html(page([block("rich_text", { html: "<p><b>Hi</b><script>x()</script></p>" })]), {
      sanitizeHtml: (h: string) => h.replace(/<script.*?<\/script>/g, ""),
    });
    expect(out).toContain("<p><b>Hi</b></p>");
  });

  describe("video and embed", () => {
    const attrs = (out: string) => {
      const tag = out.match(/<iframe[^>]*>/)?.[0] ?? "";
      return Object.fromEntries([...tag.matchAll(/([a-zA-Z]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    };

    it("frames a provider with exactly the resolved src, sandbox, allow and referrerPolicy", () => {
      for (const type of ["video", "embed"]) {
        const a = attrs(html(page([block(type, { url: "https://evil.test/x", title: "Clip" }, { resolved: YT })])));
        expect(a.src).toBe(YT.embedUrl);
        expect(a.sandbox).toBe(YT.sandbox);
        expect(a.allow).toBe(YT.allow);
        expect(a.referrerPolicy).toBe(YT.referrerPolicy);
        expect(a.title).toBe("Clip");
        expect(a.loading).toBe("lazy");
      }
    });

    it("never frames content.url", () => {
      const out = html(page([block("embed", { url: "https://evil.test/x" }, { resolved: { ...YT, embedUrl: undefined } })]));
      expect(out).not.toContain("evil.test");
      expect(out).not.toContain("<iframe");
    });

    it("renders no empty figure when nothing can be played", () => {
      const out = html(page([
        block("video", { url: "u" }, { resolved: { provider: "youtube" } }),
        block("embed", { url: "u" }, { resolved: { ...YT, sandbox: undefined } }),
      ]));
      expect(out).not.toContain("<figure");
    });

    it("falls back to 16:9 for an aspect ratio naming an inherited key", () => {
      const out = html(page([block("embed", { url: "u", aspectRatio: "constructor" }, { resolved: YT })]));
      expect(out).toContain("aspect-ratio:16 / 9");
      expect(out).not.toContain("native code");
    });

    it("renders no frame without a sandbox", () => {
      expect(html(page([block("embed", { url: "u" }, { resolved: { ...YT, sandbox: undefined } })]))).not.toContain("<iframe");
    });

    it("falls back to a generic title and maps the aspect ratio", () => {
      const v = attrs(html(page([block("video", { url: "u" }, { resolved: YT })])));
      expect(v.title).toBe("Video");
      expect(v.style).toBe("width:100%;border:0;aspect-ratio:16 / 9");
      const e = attrs(html(page([block("embed", { url: "u", aspectRatio: "9:16" }, { resolved: YT })])));
      expect(e.title).toBe("Embedded content");
      expect(e.style).toContain("aspect-ratio:9 / 16");
      expect(attrs(html(page([block("embed", { url: "u", aspectRatio: "2:1" }, { resolved: YT })]))).style).toContain("aspect-ratio:16 / 9");
    });

    it("plays an .mp4 with <video>, not a frame", () => {
      const out = html(page([block("video", { url: MP4.fileUrl }, { resolved: MP4 })]));
      expect(out).toContain('<video src="https://cdn.test/clip.mp4" controls=""');
      expect(out).not.toContain("<iframe");
      expect(out).not.toContain("autoPlay");
      expect(out).not.toContain("<track");
    });

    it("adds poster, captions, autoplay (muted) and loop to a video file", () => {
      const out = html(page([block("video", {
        url: MP4.fileUrl, title: "Demo", poster: "https://cdn.test/p.jpg", captionsUrl: "https://cdn.test/c.vtt", autoplay: true, loop: true,
      }, { resolved: MP4 })]));
      expect(out).toContain('poster="https://cdn.test/p.jpg"');
      expect(out).toContain('muted="" autoPlay="" playsInline="" loop=""');
      expect(out).toContain('aria-label="Demo"');
      expect(out).toContain('<track kind="captions" src="https://cdn.test/c.vtt"');
      // No CORS mode, so a video host without CORS headers still plays.
      expect(out).not.toMatch(/crossorigin/i);
    });

    it("renders nothing for resolved: null, without throwing", () => {
      for (const type of ["video", "embed"]) {
        for (const resolved of [null, undefined, { provider: "file" }]) {
          expect(html(page([block(type, { url: "https://youtu.be/x" }, { resolved } as never)]))).toBe('<div class="mentra-page"></div>');
        }
      }
    });
  });

  it("forwards contentProps to the article body", () => {
    const out = html(page([SAMPLES.content_body.block]), {
      contentProps: { nodeOverrides: { paragraph: ({ children }: { children: unknown }) => <p className="x">{children as never}</p> } },
    });
    expect(out).toContain('<p class="x">Body text</p>');
  });

  it("renders related_content only when context-bound blocks are asked for, and nothing when empty", () => {
    const related = (items: unknown[]) => block("related_content", { title: "Related", style: "list" },
      { contextBound: true, resolved: { items } as PageBlock["resolved"] });
    const one = related([{ id: "s2", title: "Other post", summary: "Sum" }]);
    expect(html(page([one]))).not.toContain("Other post");
    const out = html(page([one]), { renderContextBound: true, resolveItemHref: (it: { id: string }) => `/a/${it.id}` });
    expect(out).toContain('class="mentra-block mentra-block-related-content" data-style="list"');
    expect(out).toContain('<a href="/a/s2">Other post</a>');
    expect(html(page([related([])]), { renderContextBound: true })).toBe('<div class="mentra-page"></div>');
  });

  it("links dynamic_content items through resolveItemHref", () => {
    const out = html(page([SAMPLES.dynamic_content.block]), { resolveItemHref: (it: { id: string }) => `/a/${it.id}` });
    expect(out).toContain('<a href="/a/s1">Post one</a>');
  });

  it("applies nested overrides inside columns", () => {
    const Hero: BlockComponent = () => <i>custom hero</i>;
    expect(html(page([SAMPLES.columns.block]), { blocks: { hero: Hero } })).toContain("<i>custom hero</i>");
  });

  it("exposes the theme as CSS custom properties", () => {
    const out = html(page([]), { theme: { colors: { primary: "#123456" }, fonts: { heading: "Inter" }, shape: { buttonStyle: "pill" } } });
    expect(out).toContain("--mentra-color-primary:#123456");
    expect(out).toContain("--mentra-font-heading:Inter");
    expect(out).toContain("--mentra-button-style:pill");
    expect(themeToCssVars(undefined)).toEqual({});
  });

  it("drops theme values that would end the CSS declaration", () => {
    const out = html(page([]), { theme: { colors: { primary: "red;background:url(https://t.example/)", accent: "x}" } } });
    expect(out).not.toContain("background:url");
    expect(themeToCssVars({ colors: { primary: "a;b", accent: "#fff" } })).toEqual({ "--mentra-color-accent": "#fff" });
  });

  it("ignores a columns layout that names an inherited key", () => {
    const out = html(page([block("columns", { layout: "toString", columns: [{ blocks: [] }, { blocks: [] }] })]));
    expect(out).toContain("grid-template-columns:repeat(2, 1fr)");
    expect(out).not.toContain("native code");
  });

  it("types overrides by content", () => {
    const overrides: BlockOverrides = { hero: ({ content }) => <h1>{content.heading.toUpperCase()}</h1> };
    expect(html(page([SAMPLES.hero.block]), { blocks: overrides })).toContain("WELCOME");
  });
});

describe("safeHref", () => {
  it.each([
    ["/about", "/about"], ["https://a.test", "https://a.test"], ["mailto:a@b.test", "mailto:a@b.test"],
    ["tel:+47", "tel:+47"], ["javascript:x", undefined], ["data:text/html,x", undefined],
    ["JaVaScRiPt:x", undefined], ["", undefined], [null, undefined],
  ])("%s → %s", (input, out) => expect(safeHref(input)).toBe(out));
});
