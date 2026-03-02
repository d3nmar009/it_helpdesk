export type RowsPerPage = number | "ALL";

export function getRowsPerPageOptions(totalRows: number, baseSizes: number[] = [20, 50]) {
  const sizes = [...baseSizes].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const opts: Array<{ value: string; label: string }> = [];

  if (!Number.isFinite(totalRows) || totalRows <= 0) {
    for (const s of sizes) opts.push({ value: String(s), label: String(s) });
    opts.push({ value: "ALL", label: "All" });
    return opts;
  }

  for (const s of sizes) {
    if (totalRows >= s) opts.push({ value: String(s), label: String(s) });
  }

  // If the total is smaller than some base options, show the exact total as an option.
  if (totalRows < Math.max(...sizes)) {
    const v = String(totalRows);
    if (!opts.some((o) => o.value === v)) opts.push({ value: v, label: v });
  }

  opts.push({ value: "ALL", label: "All" });
  return opts;
}

export function normalizeRowsPerPage(totalRows: number, pageSize: RowsPerPage, defaultSize = 20): RowsPerPage {
  if (pageSize === "ALL") return "ALL";
  const n = Number(pageSize);
  if (!Number.isFinite(n) || n <= 0) return defaultSize;
  if (Number.isFinite(totalRows) && totalRows > 0 && n > totalRows) return totalRows;
  return n;
}



