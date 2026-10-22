import React, { ReactNode } from "react";
import type { TipTapNode, InternalLink, NodeRenderer, MarkRenderer, MentraContentProps } from "./types";
import { safeHref, str } from "./page/util";
import { IFRAME_REFERRER_POLICY, IFRAME_SANDBOX, iframeAllow, isSafeHttpsUrl, parseEmbedUrl } from "./embed";

const SIZE_STYLES: Record<string, React.CSSProperties> = {
  small:  { maxWidth: "25%" },
  medium: { maxWidth: "50%" },
  large:  { maxWidth: "75%" },
  xl:     { maxWidth: "100%" },
};

const ALIGN_STYLES: Record<string, React.CSSProperties> = {
  left:   { float: "left", marginRight: "1em" },
  center: { display: "block", marginLeft: "auto", marginRight: "auto" },
  right:  { float: "right", marginLeft: "1em" },
};

const EMBED_TITLES: Record<string, string> = {
  youtube: "YouTube video",
  vimeo: "Vimeo video",
  loom: "Loom video",
  spotify: "Spotify player",
  google_maps: "Google Map",
};

const CALLOUT_VARIANTS = new Set(["note", "tip", "warning", "info"]);

/** A trimmed string attribute, or `""` when it is missing or not a string. */
const textAttr = (node: TipTapNode, key: string): string => str(node.attrs?.[key]) ?? "";

/**
 * Pull quote as `<figure>`: the quote, plus a `<figcaption>` attribution that
 * links to `sourceUrl` only when that URL is safe. Matches Mentra's
 * published HTML.
 */
const PullQuote: NodeRenderer = ({ node, children }) => {
  const url = safeHref(node.attrs?.sourceUrl);
  const attribution = textAttr(node, "attribution");
  return (
    <figure>
      <blockquote cite={url}><p>{children}</p></blockquote>
      {attribution && (
        <figcaption>
          {url ? <a href={url} rel="noopener noreferrer">{attribution}</a> : attribution}
        </figcaption>
      )}
    </figure>
  );
};

const isHeaderRow = (row: TipTapNode) =>
  !!row.content?.length && row.content.every((cell) => cell.type === "tableHeader");

/**
 * `<table>` with its leading all-`tableHeader` rows in `<thead>`, the rest in
 * `<tbody>`, matching Mentra's published HTML.
 */
const Table: NodeRenderer = ({ node, children }) => {
  const rows = React.Children.toArray(
    React.isValidElement<{ children?: ReactNode }>(children) ? children.props.children : children,
  );
  const source = node.content ?? [];
  let split = 0;
  while (split < source.length && isHeaderRow(source[split])) split += 1;
  const head = rows.slice(0, split);
  const body = rows.slice(split);
  return (
    <table>
      {head.length > 0 && <thead>{head}</thead>}
      {body.length > 0 && <tbody>{body}</tbody>}
    </table>
  );
};

/**
 * An allowlisted provider URL as a sandboxed iframe; any other https URL as a
 * link; anything else as nothing. The frame `src` is built by the allowlist
 * parser, never taken from the node.
 */
const Embed: NodeRenderer = ({ node }) => {
  const url: unknown = node.attrs?.url;
  const parsed = parseEmbedUrl(url);
  if (parsed) {
    return (
      <figure data-embed={parsed.provider}>
        <iframe
          src={parsed.embedUrl}
          title={EMBED_TITLES[parsed.provider] ?? "Embedded content"}
          sandbox={IFRAME_SANDBOX}
          allow={iframeAllow(parsed.provider)}
          referrerPolicy={IFRAME_REFERRER_POLICY}
          loading="lazy"
          allowFullScreen
          style={parsed.provider === "spotify" ? { width: "100%", border: 0, height: 152 } : { width: "100%", border: 0, aspectRatio: "16 / 9" }}
        />
      </figure>
    );
  }
  if (isSafeHttpsUrl(url)) {
    return (
      <p>
        <a href={url} rel="noopener noreferrer">{url}</a>
      </p>
    );
  }
  return null;
};

const defaultNodes: Record<string, NodeRenderer> = {
  doc: ({ children }) => <>{children}</>,
  paragraph: ({ children }) => <p>{children}</p>,
  heading: ({ node, children }) => {
    const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6);
    const Tag = `h${level}` as any;
    return <Tag>{children}</Tag>;
  },
  bulletList:  ({ children }) => <ul>{children}</ul>,
  orderedList: ({ children }) => <ol>{children}</ol>,
  listItem:    ({ children }) => <li>{children}</li>,
  blockquote:  ({ children }) => <blockquote>{children}</blockquote>,
  codeBlock: ({ node, children }) => (
    <pre><code data-language={node.attrs?.language || undefined}>{children}</code></pre>
  ),
  hardBreak:      () => <br />,
  horizontalRule: () => <hr />,
  image: ({ node }) => {
    const { src, alt: altText, caption, size, alignment } = node.attrs ?? {};
    // Alt text is edited separately from the caption; an image with only a
    // caption uses it as alt text, as Mentra's published HTML does.
    const alt = altText || caption || "";
    const style: React.CSSProperties = {
      ...(size && SIZE_STYLES[size] ? SIZE_STYLES[size] : {}),
      ...(alignment && ALIGN_STYLES[alignment] ? ALIGN_STYLES[alignment] : {}),
    };
    if (caption) {
      const figureStyle: React.CSSProperties = {
        margin: 0,
        ...(size && SIZE_STYLES[size] ? SIZE_STYLES[size] : {}),
        ...(alignment && ALIGN_STYLES[alignment] ? ALIGN_STYLES[alignment] : {}),
      };
      return (
        <figure style={figureStyle}>
          <img src={src} alt={alt} style={{ maxWidth: "100%" }} />
          <figcaption>{caption}</figcaption>
        </figure>
      );
    }
    return (
      <img
        src={src}
        alt={alt}
        style={Object.keys(style).length > 0 ? style : undefined}
        data-size={size || undefined}
        data-align={alignment || undefined}
      />
    );
  },
  table:       Table,
  tableRow:    ({ children }) => <tr>{children}</tr>,
  tableHeader: ({ children }) => <th>{children}</th>,
  tableCell:   ({ children }) => <td>{children}</td>,
  embed:       Embed,
  callout: ({ node, children }) => {
    const variant = textAttr(node, "variant");
    return <aside data-callout={CALLOUT_VARIANTS.has(variant) ? variant : "note"}>{children}</aside>;
  },
  keyTakeaways: ({ node, children }) => {
    const title = textAttr(node, "title");
    return <section data-key-takeaways="">{title && <h2>{title}</h2>}{children}</section>;
  },
  pullQuote:   PullQuote,
};

const defaultMarks: Record<string, MarkRenderer> = {
  bold:      ({ children }) => <strong>{children}</strong>,
  italic:    ({ children }) => <em>{children}</em>,
  underline: ({ children }) => <u>{children}</u>,
  strike:    ({ children }) => <s>{children}</s>,
  code:      ({ children }) => <code>{children}</code>,
};

const defaultResolveInternalLink = (link: InternalLink) => link.href;

function linkRenderer(resolveInternalLink: (link: InternalLink) => string | undefined): MarkRenderer {
  return ({ mark, children }) => {
    const attrs = mark.attrs ?? {};
    if (attrs.contentId) {
      // An internal link opens in the same tab, on whatever route you map it to.
      const href = resolveInternalLink({ contentId: attrs.contentId, slug: attrs.slug, href: attrs.href });
      return href ? <a href={href}>{children}</a> : <>{children}</>;
    }
    return <a href={attrs.href ?? "#"} target={attrs.target ?? "_blank"}>{children}</a>;
  };
}

/**
 * Renders Mentra CMS content from a TipTap/ProseMirror JSON document.
 *
 * @example
 * ```tsx
 * import { MentraContent } from "@mentra-intelligence/react";
 * <MentraContent doc={item.contentJson} />
 * ```
 */
export function MentraContent({
  doc, nodeOverrides = {}, markOverrides = {}, resolveInternalLink = defaultResolveInternalLink,
}: MentraContentProps) {
  const nodes = { ...defaultNodes, ...nodeOverrides };
  const marks: Record<string, MarkRenderer> = {
    ...defaultMarks, link: linkRenderer(resolveInternalLink), ...markOverrides,
  };

  function renderNode(node: TipTapNode, key: number): ReactNode {
    if (node.type === "text") {
      let result: ReactNode = node.text ?? "";
      for (const mark of node.marks ?? []) {
        const renderer = marks[mark.type];
        result = renderer ? renderer({ mark, children: result }) : result;
      }
      return <React.Fragment key={key}>{result}</React.Fragment>;
    }
    const children = (node.content ?? []).map((child, i) => renderNode(child, i));
    const renderer = nodes[node.type];
    if (!renderer) {
      return <React.Fragment key={key}>{children}</React.Fragment>;
    }
    return (
      <React.Fragment key={key}>
        {renderer({ node, children: <>{children}</> })}
      </React.Fragment>
    );
  }

  return <>{renderNode(doc, 0)}</>;
}
