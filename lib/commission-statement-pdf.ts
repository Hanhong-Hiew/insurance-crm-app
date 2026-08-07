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

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 30;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_BOTTOM_Y = PAGE_HEIGHT - 118;
const FOOTER_Y = 42;
const TABLE_HEADER_HEIGHT = 22;
const ROW_PADDING_Y = 6;
const CELL_PADDING_X = 5;
const BODY_FONT_SIZE = 7.2;
const BODY_LINE_HEIGHT = 9.2;
const SUBTLE_TEXT = [0.4, 0.48, 0.58] as [number, number, number];
const DARK_TEXT = [0.07, 0.1, 0.18] as [number, number, number];

const COLUMNS = [
  { key: "no", label: "No.", width: 24, align: "left" },
  { key: "client", label: "Client / Policy No.", width: 120, align: "left" },
  { key: "vehicle", label: "Vehicle No.", width: 62, align: "left" },
  { key: "risk", label: "Risk", width: 70, align: "left" },
  { key: "insurer", label: "Insurer", width: 72, align: "left" },
  { key: "term", label: "Term", width: 72, align: "left" },
  { key: "gross", label: "Gross / Rate", width: 72, align: "left" },
  { key: "commission", label: "Commission", width: 43, align: "left" },
] as const;

type PdfCommand = string;
type Align = "left" | "right";
type Rgb = [number, number, number];

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

function fileNamePart(value: string) {
  return cleanText(value).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Payee";
}

function insurerPdfColor(name: string | null | undefined): {
  background: Rgb;
  border: Rgb;
  text: Rgb;
} {
  const normalized = String(name ?? "").toLowerCase();

  if (normalized.includes("great eastern")) {
    return { background: [1, 0.95, 0.95], border: [0.99, 0.8, 0.8], text: [0.73, 0.11, 0.11] };
  }
  if (normalized.includes("etiqa takaful")) {
    return { background: [1, 0.98, 0.86], border: [0.99, 0.9, 0.55], text: [0.52, 0.34, 0.02] };
  }
  if (normalized.includes("etiqa general")) {
    return { background: [1, 0.95, 0.88], border: [0.99, 0.84, 0.65], text: [0.76, 0.25, 0.05] };
  }
  if (normalized.includes("qbe")) {
    return { background: [0.97, 0.95, 1], border: [0.88, 0.82, 0.98], text: [0.49, 0.23, 0.72] };
  }
  if (normalized.includes("tokio")) {
    return { background: [0.92, 0.99, 0.95], border: [0.7, 0.94, 0.82], text: [0.02, 0.47, 0.29] };
  }
  if (normalized.includes("progressive")) {
    return { background: [0.99, 0.93, 0.96], border: [0.98, 0.76, 0.86], text: [0.75, 0.15, 0.39] };
  }
  if (normalized.includes("allianz")) {
    return { background: [0.94, 0.98, 1], border: [0.73, 0.9, 0.99], text: [0.02, 0.41, 0.67] };
  }

  return { background: [0.97, 0.98, 0.99], border: [0.88, 0.91, 0.94], text: [0.29, 0.35, 0.43] };
}

function setTextColor(rgb: Rgb) {
  return `${rgb.join(" ")} rg`;
}

function line(x1: number, y1: number, x2: number, y2: number) {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  rgb: [number, number, number],
) {
  return `q ${rgb.join(" ")} rg ${x} ${y} ${width} ${height} re f Q`;
}

function textLine(
  value: string,
  x: number,
  y: number,
  options: {
    align?: Align;
    bold?: boolean;
    color?: Rgb;
    fontSize?: number;
    width?: number;
  } = {},
) {
  const fontSize = options.fontSize ?? BODY_FONT_SIZE;
  const safeValue = cleanText(value);
  const approxWidth = safeValue.length * fontSize * 0.5;
  const tx = options.align === "right" && options.width ? x + options.width - approxWidth : x;
  return [
    "BT",
    setTextColor(options.color ?? DARK_TEXT),
    `/${options.bold ? "F2" : "F1"} ${fontSize} Tf`,
    `${tx.toFixed(2)} ${y.toFixed(2)} Td`,
    `(${pdfText(safeValue)}) Tj`,
    "ET",
  ].join(" ");
}

function wrapText(value: string, width: number, fontSize = BODY_FONT_SIZE) {
  const maxChars = Math.max(5, Math.floor(width / (fontSize * 0.5)));
  const words = cleanText(value).split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

function wrappedLinesCommands({
  align = "left",
  boldFirstLine = false,
  color = DARK_TEXT,
  fontSize = BODY_FONT_SIZE,
  lineHeight = BODY_LINE_HEIGHT,
  maxLines,
  value,
  width,
  x,
  y,
}: {
  align?: Align;
  boldFirstLine?: boolean;
  color?: Rgb;
  fontSize?: number;
  lineHeight?: number;
  maxLines?: number;
  value: string;
  width: number;
  x: number;
  y: number;
}) {
  const allLines = wrapText(value, width, fontSize);
  const lines = maxLines ? allLines.slice(0, maxLines) : allLines;
  return lines.map((lineValue, index) =>
    textLine(lineValue, x, y - index * lineHeight, {
      align,
      bold: boldFirstLine && index === 0,
      color,
      fontSize,
      width,
    }),
  );
}

function cellLineCount(value: string, width: number) {
  return wrapText(value, width - CELL_PADDING_X * 2, BODY_FONT_SIZE).length;
}

function rowCells(row: CommissionStatementPdfRow, index: number) {
  return [
    [String(index + 1)],
    [
      cleanText(row.client_name),
      `Policy: ${cleanText(row.policy_number)}`,
    ],
    [row.vehicle_no ? cleanText(row.vehicle_no) : "-"],
    [cleanText(row.insurance_type)],
    [cleanText(row.insurer_name)],
    [
      `Start: ${formatDate(row.effective_date)}`,
      `End: ${formatDate(row.expiry_date)}`,
    ],
    [
      `Gross: ${money(row.gross_premium)}`,
      `Rate: ${percent(row.calculation_percent)}`,
    ],
    [money(row.amount)],
  ];
}

function rowHeight(row: CommissionStatementPdfRow, index: number) {
  const cells = rowCells(row, index);
  const maxLines = Math.max(
    ...cells.map((lines, columnIndex) => {
      const column = COLUMNS[columnIndex];
      return lines.reduce(
        (sum, value) => sum + cellLineCount(value, column.width),
        0,
      );
    }),
  );
  return Math.max(32, ROW_PADDING_Y * 2 + maxLines * BODY_LINE_HEIGHT);
}

function sortedStatementRows(rows: CommissionStatementPdfRow[]) {
  return [...rows].sort((a, b) => {
    const first = `${a.effective_date ?? "9999-99-99"}${cleanText(a.client_name)}`;
    const second = `${b.effective_date ?? "9999-99-99"}${cleanText(b.client_name)}`;
    return first.localeCompare(second);
  });
}

function statementTotal(rows: CommissionStatementPdfRow[]) {
  return rows.reduce((sum, row) => sum + toNumber(row.amount), 0);
}

function pageHeader({
  pageIndex,
  pageTotal,
  paidDate,
  payeeName,
  statementIndex,
  total,
}: {
  pageIndex: number;
  pageTotal: number;
  paidDate: string;
  payeeName: string;
  statementIndex: number;
  total: number;
}) {
  return [
    rect(0, PAGE_HEIGHT - 100, PAGE_WIDTH, 100, [0.93, 0.97, 1]),
    textLine("Kover", MARGIN, PAGE_HEIGHT - 36, { bold: true, fontSize: 12 }),
    textLine("Commission Statement", MARGIN, PAGE_HEIGHT - 60, { bold: true, fontSize: 19 }),
    textLine(`Payee: ${payeeName}`, MARGIN, PAGE_HEIGHT - 82, { fontSize: 9.5 }),
    textLine(`Statement ${statementIndex}`, MARGIN, PAGE_HEIGHT - 96, {
      color: SUBTLE_TEXT,
      fontSize: 7.5,
    }),
    textLine(`Paid date: ${formatDate(paidDate)}`, PAGE_WIDTH - MARGIN - 180, PAGE_HEIGHT - 42, {
      align: "right",
      fontSize: 9,
      width: 180,
    }),
    textLine(`Total: ${money(total)}`, PAGE_WIDTH - MARGIN - 180, PAGE_HEIGHT - 64, {
      align: "right",
      bold: true,
      fontSize: 11,
      width: 180,
    }),
    textLine(`Page ${pageIndex + 1} of ${pageTotal}`, PAGE_WIDTH - MARGIN - 180, PAGE_HEIGHT - 82, {
      align: "right",
      color: SUBTLE_TEXT,
      fontSize: 7.5,
      width: 180,
    }),
  ];
}

function tableHeader(y: number) {
  const commands: PdfCommand[] = [
    rect(MARGIN, y - TABLE_HEADER_HEIGHT + 5, CONTENT_WIDTH, TABLE_HEADER_HEIGHT, [0.96, 0.98, 1]),
    "q 0.82 0.88 0.94 RG 0.6 w",
    line(MARGIN, y - TABLE_HEADER_HEIGHT + 5, PAGE_WIDTH - MARGIN, y - TABLE_HEADER_HEIGHT + 5),
    line(MARGIN, y + 5, PAGE_WIDTH - MARGIN, y + 5),
    "Q",
  ];
  let x = MARGIN;
  for (const column of COLUMNS) {
    commands.push(
      textLine(column.label, x + CELL_PADDING_X, y - 9, {
        align: column.align,
        bold: true,
        color: SUBTLE_TEXT,
        fontSize: 7,
        width: column.width - CELL_PADDING_X * 2,
      }),
    );
    x += column.width;
  }
  return commands;
}

function rowCommands(row: CommissionStatementPdfRow, index: number, topY: number) {
  const height = rowHeight(row, index);
  const bottomY = topY - height;
  const cells = rowCells(row, index);
  const commands: PdfCommand[] = [
    ...(index % 2 === 0
      ? [rect(MARGIN, bottomY, CONTENT_WIDTH, height, [0.99, 0.995, 1])]
      : []),
    "q 0.88 0.92 0.96 RG 0.45 w",
    line(MARGIN, bottomY, PAGE_WIDTH - MARGIN, bottomY),
    "Q",
  ];

  let x = MARGIN;
  cells.forEach((lines, columnIndex) => {
    const column = COLUMNS[columnIndex];
    const insurerColor =
      column.key === "insurer" ? insurerPdfColor(row.insurer_name) : null;
    if (insurerColor) {
      commands.push(
        rect(
          x + 2,
          bottomY + 4,
          column.width - 4,
          Math.max(10, height - 8),
          insurerColor.background,
        ),
        `q ${insurerColor.border.join(" ")} RG 0.5 w ${x + 2} ${bottomY + 4} ${column.width - 4} ${Math.max(10, height - 8)} re S Q`,
      );
    }
    let y = topY - ROW_PADDING_Y - BODY_FONT_SIZE;
    lines.forEach((value, lineIndex) => {
      const isPrimary = column.key === "client" && lineIndex === 0;
      const lineCommands = wrappedLinesCommands({
        align: column.align,
        boldFirstLine: isPrimary,
        color: insurerColor?.text ?? (isPrimary ? DARK_TEXT : lineIndex === 0 ? DARK_TEXT : SUBTLE_TEXT),
        fontSize: isPrimary ? 7.6 : BODY_FONT_SIZE,
        value,
        width: column.width - CELL_PADDING_X * 2,
        x: x + CELL_PADDING_X,
        y,
      });
      commands.push(...lineCommands);
      y -= cellLineCount(value, column.width) * BODY_LINE_HEIGHT;
    });
    x += column.width;
  });

  return {
    commands,
    height,
  };
}

function pageFooter() {
  return [
    "q 0.85 0.9 0.95 RG 0.7 w",
    line(MARGIN, 62, PAGE_WIDTH - MARGIN, 62),
    "Q",
    textLine("Prepared from selected unpaid commission rows.", MARGIN, 42, {
      color: SUBTLE_TEXT,
      fontSize: 7,
    }),
    textLine("Confirm payment only after the actual payment is made.", PAGE_WIDTH - MARGIN - 240, 42, {
      align: "right",
      color: SUBTLE_TEXT,
      fontSize: 7,
      width: 240,
    }),
  ];
}

function paginateRows(rows: CommissionStatementPdfRow[]) {
  const pages: CommissionStatementPdfRow[][] = [];
  let currentPage: CommissionStatementPdfRow[] = [];
  let currentHeight = 0;
  const availableHeight = HEADER_BOTTOM_Y - TABLE_HEADER_HEIGHT - FOOTER_Y - 34;

  rows.forEach((row, index) => {
    const height = rowHeight(row, index);
    if (currentPage.length && currentHeight + height > availableHeight) {
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 0;
    }
    currentPage.push(row);
    currentHeight += height;
  });

  pages.push(currentPage);
  return pages;
}

function buildStatementPages(input: CommissionStatementPdfInput, statementIndex: number) {
  const rows = sortedStatementRows(input.rows);
  const total = statementTotal(rows);
  const rowPages = paginateRows(rows);

  return rowPages.map((pageRowsForStatement, pageIndex) => {
    const commands: PdfCommand[] = [
      ...pageHeader({
        pageIndex,
        pageTotal: rowPages.length,
        paidDate: input.paidDate,
        payeeName: input.payeeName,
        statementIndex,
        total,
      }),
      ...tableHeader(HEADER_BOTTOM_Y),
    ];

    let y = HEADER_BOTTOM_Y - TABLE_HEADER_HEIGHT;
    pageRowsForStatement.forEach((row) => {
      const rowBlock = rowCommands(row, rows.indexOf(row), y);
      commands.push(...rowBlock.commands);
      y -= rowBlock.height;
    });
    commands.push(...pageFooter());
    return commands.join("\n");
  });
}

function buildPdf(inputs: CommissionStatementPdfInput[]) {
  const pages = inputs.flatMap((input, index) => buildStatementPages(input, index + 1));
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

function downloadPdf(pdf: string, fileName: string) {
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCommissionStatementPdf(input: CommissionStatementPdfInput) {
  downloadPdf(
    buildPdf([input]),
    `commission-statement-${fileNamePart(input.payeeName)}-${input.paidDate || "draft"}.pdf`,
  );
}

export function downloadCommissionStatementsPdf(inputs: CommissionStatementPdfInput[]) {
  downloadPdf(
    buildPdf(inputs),
    `commission-statements-${inputs[0]?.paidDate || "draft"}.pdf`,
  );
}
