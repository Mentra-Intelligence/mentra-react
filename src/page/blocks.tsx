/**
 * Default components for supported page blocks, and their content types.
 *
 * The contract is Mentra's `docs/page-block-content-schema.md` (#3894).
 * Register each block's content interface and component here. Fields of its
 * own in `resolved` go on `PageBlock` in `types.ts`.
 *
 * The defaults render semantic HTML with `mentra-block-*` class names.
 * Every one returns `null` rather than an empty shell when the fields the
 * contract marks render-required are missing, and skips `null` list entries.
 */
import type { CSSProperties, ReactNode } from "react";
import { MentraContent } from "../MentraContent";
import type { TipTapNode } from "../types";
import { DataBars, type DataBarsContent } from "../DataBars";
import type {
  BlockComponent, BlockProps, DynamicItem, FormResolved, LinkValue, PageBlock, PageRenderContext,
} from "./types";
import { htmlToText, str, strList, list } from "./util";
import { httpsUrl, mediaFrame, videoFigure, videoNeedsMotionCheck } from "./media";
import { MotionVideo } from "./motion";
import { formConsentField } from "./form";
import { TableBlock, type TableContent } from "./table";

export { TableBlock } from "./table";
export type { TableCell, TableContent } from "./table";

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
export type SurfaceStyle = "default" | "bordered" | "tinted";
export interface Column { id?: string; blocks?: unknown[]; surfaceStyle?: SurfaceStyle | null }

export interface HeroContent {
  heading: string; subheading?: string; ctaText?: string; ctaLink?: LinkValue | null;
  /** Optional (Mentra #4977): a short line above the heading. */
  eyebrow?: string;
  /** Optional (Mentra #4977): inline HTML (bold, italic, links), sanitized by
   * Mentra on save; shown instead of `subheading` when set. */
  subheadingHtml?: string;
  /** Optional (Mentra #4977): centred when absent. */
  textAlign?: "left" | "center";
  /** Optional (Mentra #5001): the same background, overlay and second button as `dynamic_hero`. */
  backgroundImage?: string; overlayOpacity?: number | null;
  secondaryCtaText?: string; secondaryCtaLink?: LinkValue | null;
}
export interface DynamicHeroContent {
  heading: string; subheading?: string; backgroundImage?: string;
  primaryCtaText?: string; primaryCtaLink?: LinkValue | null;
  secondaryCtaText?: string; secondaryCtaLink?: LinkValue | null;
  alignment?: "left" | "center" | "right"; overlayOpacity?: number | null; height?: string;
}
export interface RichTextContent { html: string; surfaceStyle?: SurfaceStyle | null }
export interface ImageContent { url: string; alt?: string }
export interface GalleryItem {
  url: string | null;
  alt?: string | null;
  caption?: string | null;
  decorative?: boolean | null;
  link?: LinkValue | null;
  focalPoint?: { x: number; y: number } | null;
}
export interface GalleryContent {
  label?: string | null;
  items?: (GalleryItem | null)[] | null;
  layout?: "grid" | "carousel" | null;
  autoplay?: boolean | null;
  interval?: number | null;
  loop?: boolean | null;
}
export interface VideoContent {
  url: string; title?: string; poster?: string | null; captionsUrl?: string | null;
  /** Hint: start playing on load, always muted. */
  autoplay?: boolean;
  /** Hint: restart when it ends. */
  loop?: boolean;
  /** Hint: frame shape for a provider video, default `16:9`; a video file keeps its own. */
  aspectRatio?: "16:9" | "4:3" | "1:1" | "9:16";
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
export interface RelatedContentContent {
  title?: string; limit?: number; style?: "grid" | "list" | "cards";
}
/** Where a `form` block sends sign-ups. Public identifiers only, never a key. */
export interface FormDestination {
  type: "mailchimp" | "hubspot" | "webhook";
  actionUrl?: string; portalId?: string; formGuid?: string; url?: string;
}
export interface FormContent {
  heading?: string; description?: string; emailLabel?: string;
  collectName?: boolean; nameLabel?: string; consentText?: string;
  buttonText?: string; successMessage?: string;
  /** Just `{type}` on a preview read; `null` when there is no valid destination. */
  destination?: FormDestination | FormDestinationTypeOnly | null;
}
export interface FormDestinationTypeOnly { type: FormDestination["type"] }

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
function MaybeLink({ text, link, context, className, style }: {
  text: string; link: unknown; context: PageRenderContext; className: string; style?: CSSProperties;
}) {
  const attrs = linkAttrs(link, context);
  return attrs
    ? <a className={className} {...attrs} style={style}>{text}</a>
    : <span className={className} style={style}>{text}</span>;
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

/** Explicit surfaces opt into the companion stylesheet. Default keeps its markup. */
function surfaceStyle(value: unknown): "bordered" | "tinted" | undefined {
  return value === "bordered" || value === "tinted" ? value : undefined;
}

// ---------------------------------------------------------------- defaults

/** Overlay when none is stored, and the floor that keeps text over an image readable. */
export const HERO_DEFAULT_OVERLAY = 0.55;
export const HERO_MIN_TEXT_OVERLAY = 0.55;

/** The darkening overlay for text over an image: always a finite number in [0.55, 1]. */
export function heroOverlayOpacity(value: unknown): number {
  const v = typeof value === "number" && Number.isFinite(value) ? value : HERO_DEFAULT_OVERLAY;
  return Math.min(1, Math.max(HERO_MIN_TEXT_OVERLAY, v));
}

/**
 * The one hero layout behind `hero` and `dynamic_hero` (Mentra #5001): the
 * two stored types differ only in the primary button's field names. The
 * background image is decorative (a CSS background, so it has no alt text),
 * darkened enough for the white text on it to stay readable.
 */
function Hero({ content, context, className, primaryText, primaryLink, align, linkedButtonsOnly }: {
  content: Record<string, unknown>; context: PageRenderContext; className: string;
  primaryText: unknown; primaryLink: unknown; align?: string;
  /** `hero` (Mentra #4977): a button shows only when its link resolves; no plain-text fallback. */
  linkedButtonsOnly?: boolean;
}) {
  const heading = str(content.heading);
  if (!heading) return null;
  const eyebrow = str(content.eyebrow);
  const sub = str(content.subheading);
  const subHtml = str(content.subheadingHtml);
  const bg = context.resolveImage(str(content.backgroundImage));
  const linked = (text: string | undefined, link: unknown) =>
    text && (!linkedButtonsOnly || linkAttrs(link, context)) ? text : undefined;
  const primary = linked(str(primaryText), primaryLink);
  const secondary = linked(str(content.secondaryCtaText), content.secondaryCtaLink);
  const shade = heroOverlayOpacity(content.overlayOpacity);
  const style = bg
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,${shade}), rgba(0,0,0,${shade})), url(${JSON.stringify(bg)})`,
        backgroundSize: "cover", backgroundPosition: "center", color: "#fff",
      }
    : undefined;
  // Links don't inherit the section's colour, so over an image they take it
  // explicitly: otherwise they keep the browser's blue on the dark overlay.
  const ctaStyle = bg ? { color: "inherit" } : undefined;
  return (
    <section className={className} data-align={align} style={style}>
      {eyebrow && <p className="mentra-block-eyebrow">{eyebrow}</p>}
      <h1>{heading}</h1>
      {subHtml ? <HeroSubheadingHtml html={subHtml} context={context} /> : sub && <p>{sub}</p>}
      {(primary || secondary) && (
        <div className="mentra-block-actions">
          {primary && <MaybeLink className="mentra-block-cta" text={primary} link={primaryLink} context={context} style={ctaStyle} />}
          {secondary && <MaybeLink className="mentra-block-cta mentra-block-cta-secondary" text={secondary} link={content.secondaryCtaLink} context={context} style={ctaStyle} />}
        </div>
      )}
    </section>
  );
}

/** `subheadingHtml`: injected only through `sanitizeHtml`, otherwise its text. */
function HeroSubheadingHtml({ html, context }: { html: string; context: PageRenderContext }) {
  if (context.sanitizeHtml) return <p dangerouslySetInnerHTML={{ __html: context.sanitizeHtml(html) }} />;
  const text = htmlToText(html);
  return text ? <p>{text}</p> : null;
}

export function HeroBlock({ content, context }: Props<HeroContent>) {
  const c = content as unknown as Record<string, unknown>;
  return (
    <Hero content={c} context={context} className="mentra-block mentra-block-hero"
      primaryText={c.ctaText} primaryLink={c.ctaLink} linkedButtonsOnly
      align={c.textAlign === "left" ? "left" : undefined} />
  );
}

export function DynamicHeroBlock({ content, context }: Props<DynamicHeroContent>) {
  const c = content as unknown as Record<string, unknown>;
  return (
    <Hero content={c} context={context} className="mentra-block mentra-block-dynamic-hero"
      primaryText={c.primaryCtaText} primaryLink={c.primaryCtaLink} align={str(c.alignment)} />
  );
}

/** The sample paragraph blocks added before Mentra #4995 may still carry. */
const RICH_TEXT_SAMPLE = "<p>Start typing your content here...</p>";
const RICH_TEXT_MEDIA = /<(img|iframe|video|audio|hr|table|svg|picture)\b/i;

/**
 * True when rich_text html has nothing to show: the sample paragraph, or
 * no text once tags, `&nbsp;` and whitespace are stripped and no media markup.
 * Mirrors Mentra's `frontend/src/components/RichTextBlock.tsx`.
 */
function isEmptyRichText(html: string): boolean {
  if (html.trim() === RICH_TEXT_SAMPLE) return true;
  if (RICH_TEXT_MEDIA.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, "").trim() === "";
}

export function RichTextBlock({ content, context }: Props<RichTextContent>) {
  const html = str(content.html);
  if (!html || isEmptyRichText(html)) return null;
  const surface = surfaceStyle(content.surfaceStyle);
  if (context.sanitizeHtml) {
    return (
      <div
        className="mentra-block mentra-block-rich-text"
        data-surface-style={surface}
        dangerouslySetInnerHTML={{ __html: context.sanitizeHtml(html) }}
      />
    );
  }
  // No sanitiser: never inject the HTML, render its text instead.
  const text = htmlToText(html);
  if (!text) return null;
  return (
    <div className="mentra-block mentra-block-rich-text" data-surface-style={surface}>
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

function galleryPosition(focalPoint: GalleryItem["focalPoint"]): string | undefined {
  const { x, y } = focalPoint ?? {};
  if (typeof x !== "number" || typeof y !== "number" || !(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return undefined;
  return `${x * 100}% ${y * 100}%`;
}

function GalleryFigure({ item, src, context, className }: {
  item: GalleryItem; src: string; context: PageRenderContext; className?: string;
}) {
  const alt = item.decorative === true ? "" : str(item.alt) ?? "";
  const caption = str(item.caption);
  const link = linkAttrs(item.link, context);
  const position = galleryPosition(item.focalPoint);
  const image = <img src={src} alt={alt} loading="lazy" decoding="async"
    style={{ display: "block", width: "100%", height: "auto", objectPosition: position }} />;
  return (
    <figure className={className}>
      {link ? <a {...link} aria-label={alt ? undefined : caption ?? "Open link"}>{image}</a> : image}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export function GalleryBlock({ content, context }: Props<GalleryContent>) {
  const images = list<GalleryItem>(content.items).flatMap((item) => {
    const src = context.resolveImage(str(item.url));
    return src ? [{ item, src }] : [];
  });
  const [first] = images;
  if (!first) return null;
  const className = "mentra-block mentra-block-gallery";
  if (images.length === 1 && content.layout !== "carousel") {
    return <GalleryFigure {...first} context={context} className={className} />;
  }
  // A grid keeps every image readable even on a site with no client-side carousel.
  return (
    <section className={className} aria-label={str(content.label) ?? "Image gallery"}>
      <ul className="mentra-gallery-grid" role="list">
        {images.map((image, i) => <li key={i}><GalleryFigure {...image} context={context} /></li>)}
      </ul>
    </section>
  );
}

// Media (`video`, `embed`): the markup and its safety rules are in `media.tsx`.

const ASPECT_RATIOS: Record<string, string> = {
  "16:9": "16 / 9", "4:3": "4 / 3", "1:1": "1 / 1", "9:16": "9 / 16",
};

function ratio(value: unknown): string {
  const key = str(value);
  return key && Object.prototype.hasOwnProperty.call(ASPECT_RATIOS, key) ? ASPECT_RATIOS[key] : ASPECT_RATIOS["16:9"];
}

export function VideoBlock({ block, content }: Props<VideoContent>) {
  const r = block.resolved;
  if (!r || typeof r !== "object") return null;
  const aspectRatio = ratio(content.aspectRatio);
  // Only output that depends on reduced motion needs the client component;
  // everything else renders on the server with no hooks.
  if (videoNeedsMotionCheck(r, content)) {
    // Return `null` here, not an empty client boundary, when nothing can play.
    if (!videoFigure(r, content, aspectRatio, true)) return null;
    return <MotionVideo resolved={r} content={content} aspectRatio={aspectRatio} />;
  }
  return videoFigure(r, content, aspectRatio, false);
}

export function EmbedBlock({ block, content }: Props<EmbedContent>) {
  const r = block.resolved;
  if (!r || typeof r !== "object" || r.provider === "file") return null;
  const frame = mediaFrame(r, str(content.title) ?? "Embedded content", ratio(content.aspectRatio));
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
  const hasSurface = columns.some((col) => surfaceStyle(col.surfaceStyle));
  return (
    <div
      className="mentra-block mentra-block-columns"
      data-layout={layout}
      data-column-surfaces={hasSurface ? "" : undefined}
      style={{ display: "grid", gridTemplateColumns: hasSurface ? `var(--mentra-visual-columns, ${template})` : template }}
    >
      {columns.map((col, i) => (
        <div key={str(col.id) ?? i} className="mentra-block-column" data-surface-style={surfaceStyle(col.surfaceStyle)}>
          {context.renderBlocks(col.blocks)}
        </div>
      ))}
    </div>
  );
}

export function DataBarsBlock({ content }: Props<DataBarsContent>) {
  return <DataBars content={content} className="mentra-block mentra-block-data-bars" />;
}

/** The item list `dynamic_content` and `related_content` share. */
function ItemList({ block, title, style, context, className }: {
  block: Props<unknown>["block"]; title: unknown; style: unknown;
  context: PageRenderContext; className: string;
}) {
  const items = list<DynamicItem>(block.resolved?.items).filter((it) => str(it.title));
  if (!items.length) return null;
  const layout = str(style) ?? "grid";
  return (
    <section className={`mentra-block ${className}`} data-style={layout}>
      <Title text={str(title)} />
      <ul>
        {items.map((item, i) => {
          const href = context.resolveItemHref(item, block);
          const cover = context.resolveImage(str(item.coverImageUrl));
          const summary = str(item.summary);
          const itemTitle: ReactNode = href ? <a href={href}>{str(item.title)}</a> : str(item.title);
          return (
            <li key={str(item.id) ?? i}>
              {cover && <img src={cover} alt="" />}
              <h3>{itemTitle}</h3>
              {summary && <p>{summary}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function DynamicContentBlock({ block, content, context }: Props<DynamicContentContent>) {
  return (
    <ItemList block={block} title={content.title} style={content.style} context={context}
      className="mentra-block-dynamic-content" />
  );
}

/**
 * Other items for the article a template is laid out for (#3958): `/v1`
 * fills `resolved.items` when the article is read with `include=layout`.
 * The block is context-bound, so it renders only with `renderContextBound`,
 * and renders nothing when there are no items.
 */
export function RelatedContentBlock({ block, content, context }: Props<RelatedContentContent>) {
  return (
    <ItemList block={block} title={content.title} style={content.style} context={context}
      className="mentra-block-related-content" />
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

// ---------------------------------------------------------------- form
//
// The visitor's browser posts straight to the tenant's service; Mentra never
// receives the submission. The default is a native HTML form, so it works
// without client JavaScript:
// - a preview read (`resolved.preview`) draws the form with the button
//   disabled and says submitting is off; it never gets the live URL;
// - `webhook` posts the form to `submitUrl` (the page navigates to the
//   endpoint's reply);
// - `mailchimp` posts to `submitUrl` in a new tab (Mailchimp's own
//   confirmation page);
// - `hubspot` takes only a JSON body, which a native form can't send, so the
//   default renders nothing on a live read: override `form` with a client
//   component that calls `submitMentraForm` (see the README).

/** `resolved`, when it has everything a form needs. */
function formResolved(r: PageBlock["resolved"]): FormResolved | null {
  if (!r || typeof r !== "object") return null;
  const f = r.fieldNames;
  if (!f || typeof f !== "object" || typeof f.email !== "string" || typeof f.name !== "string") return null;
  if (typeof r.honeypotField !== "string" || typeof r.type !== "string") return null;
  return r as FormResolved;
}

export function FormBlock({ block, content }: Props<FormContent>) {
  const r = formResolved(block.resolved);
  if (!r) return null;
  // Anything but an explicit live read with an https URL is a preview.
  const submitUrl = r.preview === false ? httpsUrl(r.submitUrl) : undefined;
  if (submitUrl && r.encoding !== "form") return null;
  const heading = str(content.heading);
  const description = str(content.description);
  const consent = str(content.consentText);
  const consentField = formConsentField(r);
  return (
    <section className="mentra-block mentra-block-form">
      <form
        method="post"
        action={submitUrl}
        target={submitUrl && r.type === "mailchimp" ? "_blank" : undefined}
      >
        {heading && <h2>{heading}</h2>}
        {description && <p>{description}</p>}
        {content.collectName === true && (
          <label>
            <span>{str(content.nameLabel) ?? "Name"}</span>
            <input type="text" name={r.fieldNames.name} autoComplete="name" />
          </label>
        )}
        <label>
          <span>{str(content.emailLabel) ?? "Email"}</span>
          <input type="email" name={r.fieldNames.email} required autoComplete="email" />
        </label>
        {/* Bot trap: off-screen and hidden from assistive tech; people leave it empty. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
          <input type="text" name={r.honeypotField} tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>
        {consent && (
          <label>
            <input type="checkbox" name={consentField?.name} value={consentField?.value} required />
            <span>{consent}</span>
          </label>
        )}
        <button type="submit" disabled={!submitUrl}>{str(content.buttonText) ?? "Subscribe"}</button>
        {!submitUrl && <p className="mentra-form-note">Preview: submitting is off.</p>}
      </form>
    </section>
  );
}

// ---------------------------------------------------------------- registry

/** Default components for the block types this package supports. */
export const defaultBlocks = {
  hero: HeroBlock,
  dynamic_hero: DynamicHeroBlock,
  rich_text: RichTextBlock,
  image: ImageBlock,
  gallery: GalleryBlock,
  video: VideoBlock,
  embed: EmbedBlock,
  features_grid: FeaturesGridBlock,
  testimonials: TestimonialsBlock,
  faq: FaqBlock,
  pricing: PricingBlock,
  cta: CtaBlock,
  columns: ColumnsBlock,
  table: TableBlock,
  data_bars: DataBarsBlock,
  dynamic_content: DynamicContentBlock,
  content_body: ContentBodyBlock,
  meta_info: MetaInfoBlock,
  context_navigation: ContextNavigationBlock,
  related_content: RelatedContentBlock,
  form: FormBlock,
} satisfies Record<string, BlockComponent>;

/** A block type this package knows. */
export type KnownBlockType = keyof typeof defaultBlocks;

/** Per-type content, for typing overrides: `BlockComponent<BlockContentMap["hero"]>`. */
export interface BlockContentMap {
  hero: HeroContent;
  dynamic_hero: DynamicHeroContent;
  rich_text: RichTextContent;
  image: ImageContent;
  gallery: GalleryContent;
  video: VideoContent;
  embed: EmbedContent;
  features_grid: FeaturesGridContent;
  testimonials: TestimonialsContent;
  faq: FaqContent;
  pricing: PricingContent;
  cta: CtaContent;
  columns: ColumnsContent;
  table: TableContent;
  data_bars: DataBarsContent;
  dynamic_content: DynamicContentContent;
  content_body: ContentBodyContent;
  meta_info: MetaInfoContent;
  context_navigation: ContextNavigationContent;
  related_content: RelatedContentContent;
  form: FormContent;
}

/**
 * Overrides keyed by block type. Known types are typed by their content;
 * any other string is accepted, so a site can render a type newer than
 * this package. `null` hides a type.
 */
export type BlockOverrides =
  & { [K in KnownBlockType]?: BlockComponent<BlockContentMap[K]> | null }
  & { [type: string]: BlockComponent | null | undefined };
