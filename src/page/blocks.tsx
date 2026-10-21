/**
 * Default components for every page block type, and their content types.
 *
 * The contract is Mentra's `docs/page-block-content-schema.md` (#3894).
 * Adding a block type is a change to this file only: add its content
 * interface, its default component, and one entry in `defaultBlocks`.
 *
 * The defaults are unstyled semantic HTML with `mentra-block-*` class names.
 * Every one returns `null` rather than an empty shell when the fields the
 * contract marks render-required are missing, and skips `null` list entries.
 */
import type { HTMLAttributeReferrerPolicy, ReactNode } from "react";
import { MentraContent } from "../MentraContent";
import type { TipTapNode } from "../types";
import type {
  BlockComponent, BlockProps, DynamicItem, LinkValue, PageRenderContext, ResolvedMedia,
} from "./types";
import { htmlToText, str, strList, list } from "./util";

// ---------------------------------------------------------------- content

export interface FeatureItem { title: string; description?: string }
export interface TestimonialItem { quote: string; name?: string; role?: string }
export interface FaqItem { question: string; answer: string }
export interface PricingItem {
  name: string;
  price?: string;
  features?: string[];
  cta?: string;
  /** Layout hint: highlight this plan. */
  popular?: boolean;
}
export interface Column { id?: string; blocks?: unknown[] }

export interface HeroContent {
  heading: string; subheading?: string; ctaText?: string; ctaLink?: LinkValue | null;
}
export interface DynamicHeroContent {
  heading: string; subheading?: string; backgroundImage?: string;
  primaryCtaText?: string; primaryCtaLink?: LinkValue | null;
  secondaryCtaText?: string; secondaryCtaLink?: LinkValue | null;
  alignment?: "left" | "center" | "right"; overlayOpacity?: number; height?: string;
}
export interface RichTextContent { html: string }
export interface ImageContent { url: string; alt?: string }
export interface VideoContent {
  url: string; title?: string; poster?: string | null; captionsUrl?: string | null;
  /** Hint: start playing on load, always muted. */
  autoplay?: boolean;
  /** Hint: restart when it ends. */
  loop?: boolean;
}
export interface EmbedContent {
  url: string; title?: string;
  /** Hint: frame shape, default `16:9`. */
  aspectRatio?: "16:9" | "4:3" | "1:1" | "9:16";
}
export interface FeaturesGridContent { title?: string; features: (FeatureItem | null)[] }
export interface TestimonialsContent { title?: string; items: (TestimonialItem | null)[] }
export interface FaqContent { title?: string; items: (FaqItem | null)[] }
export interface PricingContent { title?: string; subtitle?: string; items: (PricingItem | null)[] }
export interface CtaContent {
  heading: string; subheading?: string; buttonText: string; buttonLink: LinkValue | null;
}
export interface ColumnsContent {
  layout?: "1-1" | "1-1-1" | "1-1-1-1" | "1-2" | "2-1"; columns: (Column | null)[];
}
export interface DynamicContentContent {
  title?: string; source?: "standalone" | "section"; sectionId?: string;
  nodeTypeKey?: string; selectionMode?: string; selectedItemIds?: string[];
  limit?: number; style?: "grid" | "list" | "cards";
}
export interface ContentBodyContent { sourceType?: "context" | "specific"; contentId?: string }
export interface MetaInfoContent { showAuthor?: boolean; showDate?: boolean; showDuration?: boolean }
export interface ContextNavigationContent {
  showPrev?: boolean; showNext?: boolean; prevLabel?: string; nextLabel?: string;
}

// ---------------------------------------------------------------- helpers

type Props<C> = BlockProps<C>;

function linkAttrs(link: unknown, context: PageRenderContext) {
  const value = link && typeof link === "object" ? (link as LinkValue) : null;
  const href = context.resolveLink(value);
  if (!href) return null;
  return value?.openInNewTab
    ? { href, target: "_blank", rel: "noopener noreferrer" }
    : { href };
}

/** A link if it resolves, otherwise plain text (never an `href`-less `<a>`). */
function MaybeLink({ text, link, context, className }: {
  text: string; link: unknown; context: PageRenderContext; className: string;
}) {
  const attrs = linkAttrs(link, context);
  return attrs
    ? <a className={className} {...attrs}>{text}</a>
    : <span className={className}>{text}</span>;
}

function Title({ text }: { text: string | undefined }) {
  return text ? <h2 className="mentra-block-title">{text}</h2> : null;
}

const GRID_TEMPLATES: Record<string, string> = {
  "1-1": "1fr 1fr",
  "1-1-1": "1fr 1fr 1fr",
  "1-1-1-1": "1fr 1fr 1fr 1fr",
  "1-2": "1fr 2fr",
  "2-1": "2fr 1fr",
};

// ---------------------------------------------------------------- defaults

export function HeroBlock({ content, context }: Props<HeroContent>) {
  const heading = str(content.heading);
  if (!heading) return null;
  const sub = str(content.subheading);
  const cta = str(content.ctaText);
  return (
    <section className="mentra-block mentra-block-hero">
      <h1>{heading}</h1>
      {sub && <p>{sub}</p>}
      {cta && <MaybeLink className="mentra-block-cta" text={cta} link={content.ctaLink} context={context} />}
    </section>
  );
}

export function DynamicHeroBlock({ content, context }: Props<DynamicHeroContent>) {
  const heading = str(content.heading);
  if (!heading) return null;
  const sub = str(content.subheading);
  const bg = context.resolveImage(str(content.backgroundImage));
  const primary = str(content.primaryCtaText);
  const secondary = str(content.secondaryCtaText);
  const align = str(content.alignment);
  return (
    <section
      className="mentra-block mentra-block-dynamic-hero"
      data-align={align}
      style={bg ? { backgroundImage: `url(${JSON.stringify(bg)})` } : undefined}
    >
      <h1>{heading}</h1>
      {sub && <p>{sub}</p>}
      {(primary || secondary) && (
        <div className="mentra-block-actions">
          {primary && <MaybeLink className="mentra-block-cta" text={primary} link={content.primaryCtaLink} context={context} />}
          {secondary && <MaybeLink className="mentra-block-cta mentra-block-cta-secondary" text={secondary} link={content.secondaryCtaLink} context={context} />}
        </div>
      )}
    </section>
  );
}

export function RichTextBlock({ content, context }: Props<RichTextContent>) {
  const html = str(content.html);
  if (!html) return null;
  if (context.sanitizeHtml) {
    return (
      <div
        className="mentra-block mentra-block-rich-text"
        dangerouslySetInnerHTML={{ __html: context.sanitizeHtml(html) }}
      />
    );
  }
  // No sanitiser: never inject the HTML, render its text instead.
  const text = htmlToText(html);
  if (!text) return null;
  return (
    <div className="mentra-block mentra-block-rich-text">
      {text.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
    </div>
  );
}

export function ImageBlock({ content, context }: Props<ImageContent>) {
  const src = context.resolveImage(str(content.url));
  if (!src) return null;
  return (
    <figure className="mentra-block mentra-block-image">
      <img src={src} alt={str(content.alt) ?? ""} />
    </figure>
  );
}

// Media (`video`, `embed`). Mentra checks the URL against its allowlist and
// returns what to play in `block.resolved`; these components use only that.
// A frame's `src` is never built from `content.url`, and its `sandbox`,
// `allow` and `referrerPolicy` are copied from `resolved` unchanged.

const ASPECT_RATIOS: Record<string, string> = {
  "16:9": "16 / 9", "4:3": "4 / 3", "1:1": "1 / 1", "9:16": "9 / 16",
};

function httpsUrl(value: unknown): string | undefined {
  const s = str(value);
  return s && /^https:\/\//i.test(s) ? s : undefined;
}

/**
 * The provider frame for `resolved`, or `null` when it can't be framed safely.
 * A plain function, not a component, so the block can return `null` itself
 * instead of an empty `<figure>`.
 */
function mediaFrame(r: Partial<ResolvedMedia>, title: string, aspectRatio: string): ReactNode {
  const src = httpsUrl(r.embedUrl);
  // Without a sandbox string the frame would get full rights, so don't render it.
  if (!src || typeof r.sandbox !== "string") return null;
  return (
    <iframe
      src={src}
      title={title}
      sandbox={r.sandbox}
      allow={typeof r.allow === "string" ? r.allow : undefined}
      referrerPolicy={typeof r.referrerPolicy === "string" ? (r.referrerPolicy as HTMLAttributeReferrerPolicy) : undefined}
      loading="lazy"
      style={{ width: "100%", border: 0, aspectRatio }}
    />
  );
}

export function VideoBlock({ block, content }: Props<VideoContent>) {
  const r = block.resolved;
  if (!r || typeof r !== "object") return null;
  const title = str(content.title);
  let body: ReactNode;
  if (r.provider === "file") {
    const src = httpsUrl(r.fileUrl);
    if (!src) return null;
    const autoplay = content.autoplay === true;
    // No `crossOrigin`: it would put the video request in CORS mode, and a
    // host without CORS headers would then stop the video loading. So the
    // track loads when the browser allows it without CORS (same origin) and
    // otherwise the video plays without captions.
    const captions = httpsUrl(content.captionsUrl);
    body = (
      <video
        src={src}
        controls
        poster={httpsUrl(content.poster)}
        muted={autoplay || undefined}
        autoPlay={autoplay || undefined}
        playsInline={autoplay || undefined}
        loop={content.loop === true || undefined}
        aria-label={title}
        style={{ width: "100%" }}
      >
        {captions && <track kind="captions" src={captions} label="Captions" default />}
      </video>
    );
  } else {
    body = mediaFrame(r, title ?? "Video", ASPECT_RATIOS["16:9"]);
    if (!body) return null;
  }
  return <figure className="mentra-block mentra-block-video">{body}</figure>;
}

export function EmbedBlock({ block, content }: Props<EmbedContent>) {
  const r = block.resolved;
  if (!r || typeof r !== "object" || r.provider === "file") return null;
  const key = str(content.aspectRatio);
  const ratio = key && Object.prototype.hasOwnProperty.call(ASPECT_RATIOS, key)
    ? ASPECT_RATIOS[key]
    : ASPECT_RATIOS["16:9"];
  const frame = mediaFrame(r, str(content.title) ?? "Embedded content", ratio);
  if (!frame) return null;
  return <figure className="mentra-block mentra-block-embed">{frame}</figure>;
}

export function FeaturesGridBlock({ content }: Props<FeaturesGridContent>) {
  const items = list(content.features).filter((f) => str(f.title));
  if (!items.length) return null;
  return (
    <section className="mentra-block mentra-block-features-grid">
      <Title text={str(content.title)} />
      <ul>
        {items.map((f, i) => (
          <li key={i}>
            <h3>{str(f.title)}</h3>
            {str(f.description) && <p>{str(f.description)}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TestimonialsBlock({ content }: Props<TestimonialsContent>) {
  const items = list(content.items).filter((t) => str(t.quote));
  if (!items.length) return null;
  return (
    <section className="mentra-block mentra-block-testimonials">
      <Title text={str(content.title)} />
      {items.map((t, i) => {
        const who = [str(t.name), str(t.role)].filter(Boolean).join(", ");
        return (
          <figure key={i}>
            <blockquote><p>{str(t.quote)}</p></blockquote>
            {who && <figcaption>{who}</figcaption>}
          </figure>
        );
      })}
    </section>
  );
}

export function FaqBlock({ content }: Props<FaqContent>) {
  const items = list(content.items).filter((q) => str(q.question) && str(q.answer));
  if (!items.length) return null;
  return (
    <section className="mentra-block mentra-block-faq">
      <Title text={str(content.title)} />
      {items.map((q, i) => (
        <details key={i}>
          <summary>{str(q.question)}</summary>
          <p>{str(q.answer)}</p>
        </details>
      ))}
    </section>
  );
}

export function PricingBlock({ content }: Props<PricingContent>) {
  const items = list(content.items).filter((p) => str(p.name));
  if (!items.length) return null;
  const subtitle = str(content.subtitle);
  return (
    <section className="mentra-block mentra-block-pricing">
      <Title text={str(content.title)} />
      {subtitle && <p>{subtitle}</p>}
      <ul>
        {items.map((p, i) => {
          const features = strList(p.features);
          return (
            <li key={i} data-popular={p.popular === true ? "true" : undefined}>
              <h3>{str(p.name)}</h3>
              {str(p.price) && <p className="mentra-block-price">{str(p.price)}</p>}
              {features.length > 0 && <ul>{features.map((f, j) => <li key={j}>{f}</li>)}</ul>}
              {str(p.cta) && <span className="mentra-block-cta">{str(p.cta)}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CtaBlock({ content, context }: Props<CtaContent>) {
  const heading = str(content.heading);
  const button = str(content.buttonText);
  if (!heading || !button) return null;
  const sub = str(content.subheading);
  return (
    <section className="mentra-block mentra-block-cta-section">
      <h2>{heading}</h2>
      {sub && <p>{sub}</p>}
      <MaybeLink className="mentra-block-cta" text={button} link={content.buttonLink} context={context} />
    </section>
  );
}

export function ColumnsBlock({ content, context }: Props<ColumnsContent>) {
  const columns = list(content.columns);
  if (!columns.length) return null;
  const layout = str(content.layout);
  const template = (layout && Object.prototype.hasOwnProperty.call(GRID_TEMPLATES, layout) && GRID_TEMPLATES[layout])
    || `repeat(${columns.length}, 1fr)`;
  return (
    <div
      className="mentra-block mentra-block-columns"
      data-layout={layout}
      style={{ display: "grid", gridTemplateColumns: template }}
    >
      {columns.map((col, i) => (
        <div key={str(col.id) ?? i} className="mentra-block-column">
          {context.renderBlocks(col.blocks)}
        </div>
      ))}
    </div>
  );
}

export function DynamicContentBlock({ block, content, context }: Props<DynamicContentContent>) {
  const items = list<DynamicItem>(block.resolved?.items).filter((it) => str(it.title));
  if (!items.length) return null;
  const style = str(content.style) ?? "grid";
  return (
    <section className="mentra-block mentra-block-dynamic-content" data-style={style}>
      <Title text={str(content.title)} />
      <ul>
        {items.map((item, i) => {
          const href = context.resolveItemHref(item, block);
          const cover = context.resolveImage(str(item.coverImageUrl));
          const summary = str(item.summary);
          const title: ReactNode = href ? <a href={href}>{str(item.title)}</a> : str(item.title);
          return (
            <li key={str(item.id) ?? i}>
              {cover && <img src={cover} alt="" />}
              <h3>{title}</h3>
              {summary && <p>{summary}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ContentBodyBlock({ block, context }: Props<ContentBodyContent>) {
  const item = block.resolved?.item;
  const doc = item && typeof item === "object" ? item.contentJson : null;
  if (!doc || typeof doc !== "object") return null;
  return (
    <article className="mentra-block mentra-block-content-body">
      <MentraContent {...context.contentProps} doc={doc as TipTapNode} />
    </article>
  );
}

/**
 * `meta_info` and `context_navigation` describe the item a page is rendered
 * for, which a standalone page response doesn't carry. They render only when
 * the site turns on `renderContextBound` and overrides them; the defaults
 * render nothing.
 */
export function MetaInfoBlock(_props: Props<MetaInfoContent>) {
  return null;
}

export function ContextNavigationBlock(_props: Props<ContextNavigationContent>) {
  return null;
}

// ---------------------------------------------------------------- registry

/** The default component for every block type in the #3894 contract. */
export const defaultBlocks = {
  hero: HeroBlock,
  dynamic_hero: DynamicHeroBlock,
  rich_text: RichTextBlock,
  image: ImageBlock,
  video: VideoBlock,
  embed: EmbedBlock,
  features_grid: FeaturesGridBlock,
  testimonials: TestimonialsBlock,
  faq: FaqBlock,
  pricing: PricingBlock,
  cta: CtaBlock,
  columns: ColumnsBlock,
  dynamic_content: DynamicContentBlock,
  content_body: ContentBodyBlock,
  meta_info: MetaInfoBlock,
  context_navigation: ContextNavigationBlock,
} satisfies Record<string, BlockComponent>;

/** A block type this package knows. */
export type KnownBlockType = keyof typeof defaultBlocks;

/** Per-type content, for typing overrides: `BlockComponent<BlockContentMap["hero"]>`. */
export interface BlockContentMap {
  hero: HeroContent;
  dynamic_hero: DynamicHeroContent;
  rich_text: RichTextContent;
  image: ImageContent;
  video: VideoContent;
  embed: EmbedContent;
  features_grid: FeaturesGridContent;
  testimonials: TestimonialsContent;
  faq: FaqContent;
  pricing: PricingContent;
  cta: CtaContent;
  columns: ColumnsContent;
  dynamic_content: DynamicContentContent;
  content_body: ContentBodyContent;
  meta_info: MetaInfoContent;
  context_navigation: ContextNavigationContent;
}

/**
 * Overrides keyed by block type. Known types are typed by their content;
 * any other string is accepted, so a site can render a type newer than
 * this package. `null` hides a type.
 */
export type BlockOverrides =
  & { [K in KnownBlockType]?: BlockComponent<BlockContentMap[K]> | null }
  & { [type: string]: BlockComponent | null | undefined };
