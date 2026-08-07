export type CommissionStatementPdfRow = {
  amount: number | string | null;
  calculation_percent: number | string | null;
  client_name: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  gross_premium: number | string | null;
  insurer_name: string | null;
  insurance_type: string | null;
  policy_number: string | null;
  vehicle_no: string | null;
};

export type CommissionStatementPdfInput = {
  paidDate: string;
  payeeName: string;
  rows: CommissionStatementPdfRow[];
};

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 28;
const TABLE_TOP = 458;
const ROW_HEIGHT = 24;
const ROWS_PER_PAGE = 16;
const COLUMNS = [
  { key: "no", label: "No", width: 25, align: "left" },
  { key: "client", label: "Client", width: 125, align: "left" },
  { key: "policy", label: "Policy / Vehicle", width: 105, align: "left" },
  { key: "risk", label: "Risk", width: 75, align: "left" },
  { key: "insurer", label: "Insurer", width: 95, align: "left" },
  { key: "term", label: "Term", width: 88, align: "left" },
  { key: "gross", label: "Gross", width: 86, align: "right" },
  { key: "rate", label: "Rate", width: 55, align: "right" },
  { key: "amount", label: "Amount", width: 86, align: "right" },
] as const;

function cleanText(value: string | null | undefined) {
  return String(value || "-")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim() || "-";
}

function pdfText(value: string) {
  return cleanText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
  const amount = toNumber(value);
  if (!amount) return "-";
  return `RM ${new Intl.NumberFormat("en-MY", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount)}`;
}

function percent(value: number | string | null | undefined) {
  const amount = toNumber(value);
  if (!amount) return "-";
  return `${(amount * 100).toFixed(2)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return cleanText(value);
}

function fitText(value: string, width: number, fontSize: number) {
  const text = cleanText(value);
  const maxChars = Math.max(4, Math.floor(width / (fontSize * 0.52)));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3))}...`;
}

function fileNamePart(value: string) {
  return cleanText(value).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Payee";
}

function line(x1: number, y1: number, x2: number, y2: number) {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

function rect(x: number, y: number, width: number, height: number, rgb: [number, number, number]) {
  return `q ${rgb.join(" ")} rg ${x} ${y} ${width} ${height} re f Q`;
}

function text(
  value: string,
  x: number,
  y: number,
  options: {
    align?: "left" | "right";
    bold?: boolean;
    fontSize?: number;
    width?: number;
  } = {},
) {
  const fontSize = options.fontSize ?? 9;
  const fitted = options.width ? fitText(value, options.width, fontSize) : cleanText(value);
  const approxWidth = fitted.length * fontSize * 0.52;
  const tx = options.align === "right" && options.width ? x + options.width - approxWidth : x;
  return `BT /${options.bold ? "F2" : "F1"} ${fontSize} Tf ${tx.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(fitted)}) Tj ET`;
}

function pageHeader({
  pageIndex,
  pageTotal,
  paidDate,
  payeeName,
  total,
}: {
  pageIndex: number;
  pageTotal: number;
  paidDate: string;
  payeeName: string;
  total: number;
}) {
  return [
    rect(0, PAGE_HEIGHT - 90, PAGE_WIDTH, 90, [0.93, 0.97, 1]),
    text("Kover", MARGIN, PAGE_HEIGHT - 38, { bold: true, fontSize: 12 }),
    text("Commission Statement", MARGIN, PAGE_HEIGHT - 62, { bold: true, fontSize: 20 }),
    text(`Payee: ${payeeName}`, MARGIN, PAGE_HEIGHT - 82, { fontSize: 10 }),
    text(`Paid date: ${formatDate(paidDate)}`, PAGE_WIDTH - MARGIN - 170, PAGE_HEIGHT - 42, {
      align: "right",
      fontSize: 10,
      width: 170,
    }),
    text(`Total: ${money(total)}`, PAGE_WIDTH - MARGIN - 170, PAGE_HEIGHT - 64, {
      align: "right",
      bold: true,
      fontSize: 12,
      width: 170,
    }),
    text(`Page ${pageIndex + 1} of ${pageTotal}`, PAGE_WIDTH - MARGIN - 170, PAGE_HEIGHT - 82, {
      align: "right",
      fontSize: 9,
      width: 170,
    }),
  ];
}

function tableHeader(y: number) {
  const commands = [
    rect(MARGIN, y - 6, PAGE_WIDTH - MARGIN * 2, 22, [0.96, 0.98, 1]),
    "q 0.85 0.9 0.95 RG 0.7 w",
    line(MARGIN, y - 6, PAGE_WIDTH - MARGIN, y - 6),
    "Q",
  ];
  let x = MARGIN + 6;
  for (const column of COLUMNS) {
    commands.push(
      text(column.label, x, y + 1, {
        align: column.align,
        bold: true,
        fontSize: 7.5,
        width: column.width - 8,
      }),
    );
    x += column.width;
  }
  return commands;
}

function rowCommands(row: CommissionStatementPdfRow, index: number, y: number) {
  const values = [
    String(index + 1),
    cleanText(row.client_name),
    `${cleanText(row.policy_number)}${row.vehicle_no ? ` / ${cleanText(row.vehicle_no)}` : ""}`,
    cleanText(row.insurance_type),
    cleanText(row.insurer_name),
    `${formatDate(row.effective_date)} to ${formatDate(row.expiry_date)}`,
    money(row.gross_premium),
    percent(row.calculation_percent),
    money(row.amount),
  ];
  const commands = [
    "q 0.9 0.93 0.96 RG 0.5 w",
    line(MARGIN, y - 7, PAGE_WIDTH - MARGIN, y - 7),
    "Q",
  ];
  let x = MARGIN + 6;
  COLUMNS.forEach((column, columnIndex) => {
    commands.push(
      text(values[columnIndex], x, y, {
        align: column.align,
        fontSize: 7.5,
        width: column.width - 8,
      }),
    );
    x += column.width;
  });
  return commands;
}

function buildPdf(input: CommissionStatementPdfInput) {
  const sortedRows = [...input.rows].sort((a, b) => {
    const first = `${a.effective_date ?? "9999-99-99"}${cleanText(a.client_name)}`;
    const second = `${b.effective_date ?? "9999-99-99"}${cleanText(b.client_name)}`;
    return first.localeCompare(second);
  });
  const total = sortedRows.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / ROWS_PER_PAGE));
  const pages: string[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageRows = sortedRows.slice(
      pageIndex * ROWS_PER_PAGE,
      pageIndex * ROWS_PER_PAGE + ROWS_PER_PAGE,
    );
    const commands = [
      ...pageHeader({
        pageIndex,
        pageTotal: pageCount,
        paidDate: input.paidDate,
        payeeName: input.payeeName,
        total,
      }),
      ...tableHeader(TABLE_TOP),
    ];
    pageRows.forEach((row, rowIndex) => {
      commands.push(
        ...rowCommands(
          row,
          pageIndex * ROWS_PER_PAGE + rowIndex,
          TABLE_TOP - 30 - rowIndex * ROW_HEIGHT,
        ),
      );
    });
    commands.push(
      "q 0.85 0.9 0.95 RG 0.7 w",
      line(MARGIN, 58, PAGE_WIDTH - MARGIN, 58),
      "Q",
      text("Prepared from selected unpaid commission rows.", MARGIN, 38, { fontSize: 8 }),
      text("Confirm payment only after the actual payment is made.", PAGE_WIDTH - MARGIN - 250, 38, {
        align: "right",
        fontSize: 8,
        width: 250,
      }),
    );
    pages.push(commands.join("\n"));
  }

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((content, index) => {
    const pageObjectId = 5 + index * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

export function downloadCommissionStatementPdf(input: CommissionStatementPdfInput) {
  const pdf = buildPdf(input);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `commission-statement-${fileNamePart(input.payeeName)}-${input.paidDate || "draft"}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
