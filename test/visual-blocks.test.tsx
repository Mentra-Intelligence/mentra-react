import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  MentraContent, MentraPage, type DataBarsContent, type MentraPageProps, type PageBlock,
} from "../src";

const block = (id: string, type: string, content: Record<string, unknown>): PageBlock => ({ id, type, content });
const page = (blocks: PageBlock[], props?: Partial<MentraPageProps>) => renderToStaticMarkup(
  <MentraPage page={{ id: "p1", slug: "page", blocks }} {...props} />,
);

describe("editorial surfaces", () => {
  it("marks explicit rich-text and column surfaces in the default renderer", () => {
    const text = block("r", "rich_text", { html: "<p>What the AI does</p>", surfaceStyle: "bordered" });
    const columns = block("c", "columns", { columns: [{ blocks: [text], surfaceStyle: "tinted" }, { blocks: [] }] });
    const output = page([columns], { theme: { colors: { primary: "#236857" } } });
    expect(output).toContain("--mentra-color-primary:#236857");
    expect(output).toContain('data-column-surfaces=""');
    expect(output).toContain('class="mentra-block-column" data-surface-style="tinted"');
    expect(output).toContain('class="mentra-block mentra-block-rich-text" data-surface-style="bordered"');
    expect(output).toContain("<p>What the AI does</p>");
    expect(page([text], { sanitizeHtml: (html) => html })).toContain('data-surface-style="bordered"');
  });

  it("treats default, absent and unknown values as ordinary content", () => {
    const plain = block("r", "rich_text", { html: "<p>Plain</p>" });
    for (const surfaceStyle of [undefined, null, "default", "unknown"]) {
      const text = { ...plain, content: { ...plain.content, surfaceStyle } };
      const columns = (style: unknown) => block("c", "columns", {
        columns: [{ blocks: [text], surfaceStyle: style }],
      });
      expect(page([text])).toBe(page([plain]));
      expect(page([columns(surfaceStyle)])).toBe(page([columns(undefined)]));
    }
  });
});

const comparison = {
  caption: "Compare workflows",
  header: [{ text: "Task" }, { html: "<b>With Mentra</b>" }],
  rows: [[{ text: "Brief" }, { text: "Prepared", html: "<strong>Approved</strong>" }]],
  firstColumnIsHeader: true,
  presentation: "comparison",
  highlightedColumn: 1,
};

describe("comparison tables", () => {
  it("uses one accessible table and marks the emphasized header and values", () => {
    const output = page([block("t", "table", comparison)]);
    expect(output).toContain('data-presentation="comparison"');
    expect(output.match(/<table\b/g)).toHaveLength(1);
    expect(output).toContain("<caption>Compare workflows</caption>");
    expect(output).toContain('<th scope="col" role="columnheader" data-highlighted="">With Mentra</th>');
    expect(output).toContain('<th scope="row" role="rowheader">');
    expect(output).toContain('<td role="cell" data-highlighted="">');
    expect(output).toContain('class="mentra-table-column-label" hidden="" aria-hidden="true">With Mentra');
    expect(output).toContain("Approved");
    expect(output).not.toContain("<strong>");
    expect(output).not.toContain("Prepared");
  });

  it("uses only sanitized HTML and preserves blank cells in short rows", () => {
    const table = {
      ...comparison,
      hideCaption: true,
      rows: [...comparison.rows, [{ text: "Short row", html: "" }]],
    };
    const output = page([block("t", "table", table)], { sanitizeHtml: (html) => html.replace(/<strong>.*<\/strong>/, "<em>Safe</em>") });
    expect(output).toContain("<em>Safe</em>");
    expect(output).toContain('clip:rect(0, 0, 0, 0)');
    expect(output).toContain("Compare workflows</caption>");
    expect(output).not.toContain("Short row");
    expect(output.match(/data-highlighted/g)).toHaveLength(3);
  });

  it("treats an out-of-range index and an ordinary table as unhighlighted", () => {
    expect(page([block("t", "table", { ...comparison, highlightedColumn: 30 })])).not.toContain("data-highlighted");
    const plain = page([block("t", "table", { ...comparison, presentation: undefined })]);
    expect(plain).toContain("<th scope=\"row\">Brief</th><td>Approved</td>");
    expect(plain).not.toMatch(/data-presentation|data-highlighted|mentra-table-column-label/);
  });
});

const breakdown: DataBarsContent = {
  title: "Costs",
  rows: [{ label: "People", description: "Two teams", value: 3.9 }, { label: "Stock", value: 4 }, { label: "Other", value: 0 }],
  unit: "€m",
  total: 7.9,
  source: "Worked example",
};

describe("data bars", () => {
  it("renders exact values beside decorative meters with one scale in pages and articles", () => {
    const output = page([block("bars", "data_bars", { ...breakdown })]);
    const article = renderToStaticMarkup(<MentraContent doc={{ type: "dataBars", attrs: { ...breakdown } }} />);
    for (const html of [output, article]) {
      expect(html).toContain('<figcaption>Costs</figcaption><table aria-label="Costs">');
      expect(html).toContain('<th scope="row">People<small> Two teams</small></th><td>3.9 €m</td>');
      expect(html).toContain('<meter min="0" max="4" value="3.9" aria-hidden="true"></meter>');
      expect(html).toContain('<meter min="0" max="4" value="0" aria-hidden="true"></meter>');
      expect(html).toContain('<tfoot><tr><th scope="row">Total</th><td>7.9 €m</td></tr></tfoot>');
      expect(html).toContain("Worked example");
      expect(html.match(/<meter\b/g)).toHaveLength(3);
    }
  });

  it("uses a positive ceiling for zero-only data and skips invalid rows", () => {
    const output = page([block("bars", "data_bars", { unit: "%", rows: [
      { label: "None", value: 0 }, null, { label: "String", value: "4" },
      { label: "Negative", value: -2 }, { label: "Nonfinite", value: Infinity }, { label: "   ", value: 9 },
    ] })]);
    expect(output).toContain("<td>0%</td>");
    expect(output).toContain('<meter min="0" max="1" value="0" aria-hidden="true"></meter>');
    expect(output).not.toMatch(/String|Negative|Nonfinite/);
    expect(output.match(/<meter\b/g)).toHaveLength(1);
  });

  it("preserves readable article children when the payload cannot be drawn", () => {
    const output = renderToStaticMarkup(<MentraContent doc={{ type: "dataBars", attrs: { rows: null }, content: [
      { type: "paragraph", content: [{ type: "text", text: "Saved fallback" }] },
    ] }} />);
    expect(output).toBe("<p>Saved fallback</p>");
    expect(page([block("bars", "data_bars", {})])).not.toContain("data-data-bars");
  });
});
