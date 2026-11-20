import type { ReactNode } from "react";
import { list } from "./page/util";

export interface DataBarsRow {
  label?: string | null;
  value?: number | null;
  description?: string | null;
}

/** Shared by the Page Builder `data_bars` block and the `dataBars` article node. */
export interface DataBarsContent {
  title?: string | null;
  rows?: (DataBarsRow | null)[] | null;
  unit?: string | null;
  source?: string | null;
  total?: number | null;
}

const plainText = (value: unknown) => typeof value === "string" ? value.trim() : "";
const isDataValue = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

function formatValue(value: number, unit: string): string {
  return unit && unit !== "%" ? `${value} ${unit}` : `${value}${unit}`;
}

export function DataBars({ content, className, fallback = null }: {
  content: DataBarsContent;
  className?: string;
  fallback?: ReactNode;
}) {
  const rows = list<DataBarsRow>(content.rows).flatMap((row) => {
    const label = plainText(row.label);
    return label && isDataValue(row.value)
      ? [{ label, value: row.value, description: plainText(row.description) }]
      : [];
  });
  if (!rows.length) return <>{fallback}</>;
  const title = plainText(content.title);
  const unit = plainText(content.unit);
  const source = plainText(content.source);
  const total = content.total;
  const max = rows.reduce((highest, row) => Math.max(highest, row.value), 0) || 1;

  return (
    <figure className={className} data-data-bars="">
      {title && <figcaption>{title}</figcaption>}
      <table aria-label={title || undefined}>
        <thead>
          <tr><th scope="col">Item</th><th scope="col">Value</th></tr>
        </thead>
        <tbody>
          {rows.map(({ label, value, description }, index) => (
            <Row key={index} label={label} value={value} description={description} unit={unit} max={max} />
          ))}
        </tbody>
        {isDataValue(total) && (
          <tfoot><tr><th scope="row">Total</th><td>{formatValue(total, unit)}</td></tr></tfoot>
        )}
      </table>
      {source && <p className="mentra-data-bars-source">{source}</p>}
    </figure>
  );
}

function Row({ label, value, description, unit, max }: {
  label: string;
  value: number;
  description: string;
  unit: string;
  max: number;
}) {
  return (
    <>
      <tr>
        <th scope="row">
          {label}{description && <small> {description}</small>}
        </th>
        <td>{formatValue(value, unit)}</td>
      </tr>
      <tr className="mentra-data-bars-track" aria-hidden="true">
        <td colSpan={2}><meter min={0} max={max} value={value} aria-hidden="true" /></td>
      </tr>
    </>
  );
}
