/**
 * Types for `GET /v1/pages/{slug}` responses and the page renderer.
 *
 * The block contract is Mentra's `docs/page-block-content-schema.md` (#3894).
 * Per-block content types live next to their default components in
 * `./blocks.tsx`, so adding a block type touches one file.
 */
import type { ComponentType, ReactNode } from "react";
import type { MentraContentProps, TipTapNode } from "../types";

/** A link written by Mentra's link picker (`LinkValue`). */
export interface LinkValue {
  type: "internal" | "external";
  /** What an internal link points at. */
  targetType?: "page" | "course" | "journey" | "step";
  /** Id (not slug) of the internal target. */
  targetId?: string;
  /** URL of an external link. */
  url?: string;
  /** Layout hint: open in a new tab. */
  openInNewTab?: boolean;
}

/** A standalone article summary, as listed by `dynamic_content` (`GET /standalone` summary shape). */
export interface StandaloneSummary {
  id: string;
  slug?: string | null;
  title?: string | null;
  summary?: string | null;
  coverImageUrl?: string | null;
  locale?: string | null;
  [key: string]: unknown;
}

/** A Section node, as listed by `dynamic_content` with `source: section`. */
export interface SectionNodeSummary {
  id: string;
  nodeTypeKey?: string | null;
  title?: string | null;
  slug?: string | null;
  [key: string]: unknown;
}

/** One item a `dynamic_content` block resolved to. */
export type DynamicItem = StandaloneSummary | SectionNodeSummary;

/** The article a `content_body` block with `sourceType: specific` resolved to. */
export interface ResolvedContentItem {
  id: string;
  slug?: string | null;
  locale?: string | null;
  title?: string | null;
  contentJson?: TipTapNode | null;
  contentHtml?: string | null;
  [key: string]: unknown;
}

/**
 * One block of a page response. `type` is a string, not a closed union: a
 * newer Mentra can send a type this version of the package doesn't know.
 */
export interface PageBlock<C = Record<string, unknown>> {
  id: string;
  type: string;
  content: C;
  dynamicMappings?: Record<string, string> | null;
  /** Set on blocks that need the item a page is rendered for (`meta_info`, …). */
  contextBound?: boolean;
  /**
   * Added by `/v1` for data-backed blocks (`dynamic_content`, specific
   * `content_body`) and for `video` / `embed`, where it is the media to play
   * or `null` when the stored URL fails Mentra's allowlist, and for `form`,
   * where it is how to submit ({@link FormResolved}) or `null` when the block
   * has no valid destination.
   */
  resolved?: (
    & { items?: DynamicItem[]; item?: ResolvedContentItem | null }
    & Partial<ResolvedMedia>
    & Partial<FormResolved>
  ) | null;
}

/**
 * The `resolved` value of a `video` or `embed` block. A provider player is
 * framed from `embedUrl` with exactly the given `sandbox`, `allow` and
 * `referrerPolicy`; a video file (`provider: "file"`) is played from `fileUrl`.
 */
export interface ResolvedMedia {
  provider: string;
  embedUrl?: string;
  fileUrl?: string;
  sandbox?: string;
  allow?: string;
  referrerPolicy?: string;
}

/**
 * The `resolved` value of a `form` block: how the visitor's browser submits
 * it, straight to the tenant's own service (Mentra never receives it).
 */
export interface FormResolved {
  type: "mailchimp" | "hubspot" | "webhook";
  method: "POST";
  /** A draft or preview-token read: `submitUrl` is `null`; never submit. */
  preview: boolean;
  submitUrl: string | null;
  /** `mailchimp` only: the JSONP variant of `submitUrl`. */
  jsonpUrl?: string | null;
  /** `form`: `application/x-www-form-urlencoded`; `json`: HubSpot's JSON body. */
  encoding: "form" | "json";
  /** Names to send each value under. `consent: null`: the service takes no consent field. */
  fieldNames: { email: string; name: string; consent: string | null };
  /** The hidden bot-trap input's name. */
  honeypotField: string;
}

/** A `GET /v1/pages/{slug}` response. */
export interface PageResponse {
  id: string;
  slug: string;
  title?: string | null;
  status?: string | null;
  blocks: PageBlock[];
  jsonLd?: Record<string, unknown>[];
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
  canonicalUrl?: string | null;
  locale?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

/**
 * The page theme. Every value is optional; the default blocks are unstyled and
 * only expose these as CSS custom properties on the page wrapper
 * (`--mentra-color-primary`, `--mentra-font-heading`, …) for the site's own CSS.
 *
 * The roles follow Mentra's brand profile (colours by role, heading/body fonts,
 * #3973; shape tokens, #3974), so a theme built from the tenant's brand tokens
 * can be passed in as-is once those ship.
 */
export interface MentraPageTheme {
  colors?: {
    primary?: string;
    accent?: string;
    background?: string;
    neutral?: string;
    text?: string;
  };
  fonts?: {
    heading?: string;
    body?: string;
  };
  shape?: {
    radius?: string;
    spacing?: string;
    shadow?: string;
    buttonStyle?: "filled" | "outline" | "pill";
  };
}

/** Everything a block component gets besides its own block. */
export interface PageRenderContext {
  theme: MentraPageTheme;
  /** The full page response being rendered. */
  page: PageResponse;
  /** `href` for a `LinkValue`, or `undefined` for no link. */
  resolveLink: (link: LinkValue | null | undefined) => string | undefined;
  /** `src` for an image URL from block content, or `undefined` to drop the image. */
  resolveImage: (url: string | undefined) => string | undefined;
  /** `href` for an item listed by `dynamic_content`, or `undefined` for no link. */
  resolveItemHref: (item: DynamicItem, block: PageBlock<any>) => string | undefined;
  /** Sanitiser for `rich_text` HTML; `undefined` when the site passed none. */
  sanitizeHtml?: (html: string) => string;
  /** Overrides forwarded to `MentraContent` when rendering an article body. */
  contentProps: Omit<MentraContentProps, "doc">;
  /** Render nested blocks (a `columns` block's children) with the same map and options. */
  renderBlocks: (blocks: unknown) => ReactNode;
}

/** Props every block component receives, default or override. */
export interface BlockProps<C = Record<string, unknown>> {
  block: PageBlock<C>;
  /** Same as `block.content`, never `null`. */
  content: C;
  context: PageRenderContext;
}

/** A component rendering one block type. */
export type BlockComponent<C = any> = ComponentType<BlockProps<C>>;
