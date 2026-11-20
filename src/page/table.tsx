import type { BlockProps } from "./types";
import { htmlToText } from "./util";

export interface TableCell { text?: string | null; html?: string | null }

export interface TableContent {
  caption?: string | null;
  header?: (TableCell | null)[] | null;
  rows: ((TableCell | null)[] | null)[];
  firstColumnIsHeader?: boolean | null;
  hideCaption?: boolean | null;
  presentation?: "comparison" | null;
  /** Zero-based index of the emphasized column in a comparison. */
  highlightedColumn?: number | null;
}

const screenReaderOnly = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0,
} as const;

function readCell(cell: TableCell | null | undefined, sanitizeHtml?: (html: string) => string) {
  if (typeof cell?.html === "string") {
    const html = sanitizeHtml?.(cell.html);
    return { html, text: htmlToText(html ?? cell.html) };
  }
  return { text: typeof cell?.text === "string" ? cell.text : "" };
}

function Cell({ cell, scope, comparison, highlighted, label }: {
  cell: ReturnType<typeof readCell>;
  scope?: "col" | "row";
  comparison: boolean;
  highlighted: boolean;
  label?: string;
}) {
  const Tag = scope ? "th" : "td";
  // CSS lays out comparison rows as cards at small widths. Keep table roles
  // explicit for browsers that remove native table semantics in that layout.
  const role = comparison ? (scope === "col" ? "columnheader" : scope === "row" ? "rowheader" : "cell") : undefined;
  return (
    <Tag scope={scope} role={role} data-highlighted={highlighted ? "" : undefined}>
      {label && <span className="mentra-table-column-label" hidden aria-hidden="true">{label}</span>}
      {cell.html === undefined ? cell.text : <span dangerouslySetInnerHTML={{ __html: cell.html }} />}
    </Tag>
  );
}

export function TableBlock({ content, context: { sanitizeHtml } }: BlockProps<TableContent>) {
  const header = Array.isArray(content.header) ? content.header : [];
  const rows = Array.isArray(content.rows) ? content.rows.filter(Array.isArray) : [];
  if (!rows.some((row) => row.length)) return null;

  const comparison = content.presentation === "comparison";
  const width = rows.reduce((max, row) => Math.max(max, row.length), header.length);
  const index = content.highlightedColumn;
  const highlighted = comparison && typeof index === "number" && Number.isInteger(index) && index >= 0 && index < width
    ? index
    : undefined;
  const headers = Array.from(header, (cell) => readCell(cell, sanitizeHtml));
  const caption = typeof content.caption === "string" && content.caption.trim() ? content.caption : undefined;

  return (
    <div className="mentra-block mentra-block-table" data-presentation={comparison ? "comparison" : undefined}>
      <table role={comparison ? "table" : undefined}>
        {caption && <caption style={content.hideCaption === true ? screenReaderOnly : undefined}>{caption}</caption>}
        {headers.length > 0 && (
          <thead role={comparison ? "rowgroup" : undefined}>
            <tr role={comparison ? "row" : undefined}>
              {headers.map((cell, column) => (
                <Cell key={column} cell={cell} scope="col" comparison={comparison} highlighted={highlighted === column} />
              ))}
            </tr>
          </thead>
        )}
        <tbody role={comparison ? "rowgroup" : undefined}>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} role={comparison ? "row" : undefined}>
              {Array.from({ length: comparison ? width : row.length }, (_, column) => (
                <Cell key={column} cell={readCell(row[column], sanitizeHtml)} comparison={comparison}
                  scope={column === 0 && content.firstColumnIsHeader === true ? "row" : undefined}
                  highlighted={highlighted === column}
                  label={comparison ? headers[column]?.text.trim() || `Column ${column + 1}` : undefined} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
