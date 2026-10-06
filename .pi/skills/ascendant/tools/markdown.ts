export type MarkdownValue = string | number | boolean;

export function escapeCell(value: MarkdownValue): string {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

export function markdownTable(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<MarkdownValue>>,
): string {
  const head = `| ${headers.map(escapeCell).join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`);
  return [head, divider, ...body].join("\n");
}
