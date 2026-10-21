import { createElement, Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import { defaultBlocks } from "./blocks";
import type { BlockOverrides } from "./blocks";
import type {
  BlockComponent, DynamicItem, LinkValue, MentraPageTheme, PageBlock,
  PageRenderContext, PageResponse,
} from "./types";
import type { MentraContentProps } from "../types";
import { safeHref, safeImageSrc } from "./util";

export interface MentraPageProps {
  /** A `GET /v1/pages/{slug}` response. */
  page: PageResponse;
  /** Components replacing the defaults, keyed by block type. `null` hides a type. */
  blocks?: BlockOverrides;
  /** Theme values, exposed as CSS custom properties on the wrapper. */
  theme?: MentraPageTheme;
  /** Render the page's `jsonLd` as `<script type="application/ld+json">`. Default `true`. */
  jsonLd?: boolean;
  /**
   * Render blocks the response marks `contextBound` (`meta_info`,
   * `context_navigation`, `related_content`, context `content_body`, mapped
   * blocks). A standalone page has no item to bind them to, so the default
   * is `false`.
   * A context-bound `columns` block renders either way; its children are
   * each checked.
   */
  renderContextBound?: boolean;
  /**
   * `href` for a link from block content. Default: an external link's URL
   * if its scheme is safe; internal links (which carry a target id, not a
   * route) render as plain text until you map them to your routes.
   */
  resolveLink?: (link: LinkValue | null | undefined) => string | undefined;
  /** `href` for a `dynamic_content` item. Default: none (titles render as text). */
  resolveItemHref?: (item: DynamicItem, block: PageBlock<any>) => string | undefined;
  /**
   * Sanitiser for `rich_text` HTML (e.g. DOMPurify's `sanitize`). Without
   * one, `rich_text` renders as plain text and its HTML is never injected.
   */
  sanitizeHtml?: (html: string) => string;
  /** Overrides forwarded to `MentraContent` for article bodies. */
  contentProps?: Omit<MentraContentProps, "doc">;
  /** Class name for the wrapping `<div>`. */
  className?: string;
}

function defaultResolveLink(link: LinkValue | null | undefined): string | undefined {
  if (!link || typeof link !== "object" || link.type !== "external") return undefined;
  return safeHref(link.url);
}

const noHref = () => undefined;

/**
 * CSS custom properties for a theme. Empty values are left out, and so are
 * values containing `;`, `{` or `}`: server-rendered, those would end the
 * declaration and add others to the wrapper's `style`.
 */
export function themeToCssVars(theme: MentraPageTheme | undefined): Record<string, string> {
  const vars: Record<string, string> = {};
  const put = (prefix: string, group: Record<string, unknown> | undefined) => {
    for (const [key, value] of Object.entries(group ?? {})) {
      if (typeof value === "string" && value.trim() && !/[;{}]/.test(value)) {
        const name = key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
        vars[`--mentra-${prefix}${name}`] = value;
      }
    }
  };
  put("color-", theme?.colors);
  put("font-", theme?.fonts);
  put("", theme?.shape);
  return vars;
}

/** JSON for an inline `<script>`: `<` escaped so content can't close the tag. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function isBlock(value: unknown): value is PageBlock {
  return (
    value !== null && typeof value === "object" &&
    typeof (value as PageBlock).type === "string"
  );
}

/**
 * Render a published page from `GET /v1/pages/{slug}`.
 *
 * Every block type has an unstyled default; pass `blocks` to replace any of
 * them. A block whose type has no component is skipped.
 */
export function MentraPage(props: MentraPageProps) {
  const {
    page, blocks: overrides, theme = {}, jsonLd = true, renderContextBound = false,
    resolveLink = defaultResolveLink, resolveItemHref = noHref, sanitizeHtml,
    contentProps = {}, className,
  } = props;

  const registry: Record<string, BlockComponent | null | undefined> = {
    ...defaultBlocks,
    ...(overrides ?? {}),
  };

  const renderBlocks = (blocks: unknown): ReactNode => {
    if (!Array.isArray(blocks)) return null;
    return blocks.map((block, i) => {
      if (!isBlock(block)) return null;
      // A context-bound `columns` block still renders: /v1 resolves and
      // marks its children individually, so each child is judged on its own.
      if (block.contextBound && !renderContextBound && block.type !== "columns") return null;
      const Component = Object.prototype.hasOwnProperty.call(registry, block.type)
        ? registry[block.type]
        : undefined;
      if (!Component) return null;
      const content = block.content && typeof block.content === "object" ? block.content : {};
      return createElement(Component, {
        key: typeof block.id === "string" && block.id ? block.id : i,
        block,
        content,
        context,
      });
    });
  };

  const context: PageRenderContext = {
    theme,
    page,
    resolveLink,
    resolveImage: safeImageSrc,
    resolveItemHref,
    sanitizeHtml,
    contentProps,
    renderBlocks,
  };

  const ld = jsonLd && Array.isArray(page?.jsonLd)
    ? page.jsonLd.filter((o) => o && typeof o === "object")
    : [];

  return (
    <div
      className={className ? `mentra-page ${className}` : "mentra-page"}
      style={themeToCssVars(theme) as CSSProperties}
    >
      {ld.map((obj, i) => (
        <script
          key={`ld-${i}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: scriptJson(obj) }}
        />
      ))}
      {createElement(Fragment, null, renderBlocks(page?.blocks))}
    </div>
  );
}
