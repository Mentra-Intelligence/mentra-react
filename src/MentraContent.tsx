import React, { ReactNode } from "react";
import type { TipTapNode, InternalLink, NodeRenderer, MarkRenderer, MentraContentProps } from "./types";

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
  table:       ({ children }) => <table>{children}</table>,
  tableRow:    ({ children }) => <tr>{children}</tr>,
  tableHeader: ({ children }) => <th>{children}</th>,
  tableCell:   ({ children }) => <td>{children}</td>,
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
