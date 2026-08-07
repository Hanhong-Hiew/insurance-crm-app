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
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 42;
const HEADER_BOTTOM_Y = PAGE_HEIGHT - 126;
const FIELD_GAP = 14;
const COLUMN_GAP = 18;
const FIELD_COLUMN_WIDTH = (CONTENT_WIDTH - COLUMN_GAP) / 2;

type PdfCommand = string;

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

function termText(row: CommissionStatementPdfRow) {
  return `${formatDate(row.effective_date)} to ${formatDate(row.expiry_date)}`;
}

function fileNamePart(value: string) {
  return cleanText(value).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Payee";
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

function strokeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  rgb: [number, number, number],
) {
  return `q ${rgb.join(" ")} RG 0.7 w ${x} ${y} ${width} ${height} re S Q`;
}

function textLine(
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
  const safeValue = cleanText(value);
  const approxWidth = safeValue.length * fontSize * 0.52;
  const tx = options.align === "right" && options.width ? x + options.width - approxWidth : x;
  return `BT /${options.bold ? "F2" : "F1"} ${fontSize} Tf ${tx.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(safeValue)}) Tj ET`;
}

function wrapText(value: string, width: number, fontSize: number) {
  const maxChars = Math.max(8, Math.floor(width / (fontSize * 0.52)));
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

function wrappedTextCommands({
  bold = false,
  fontSize = 8.5,
  lineHeight = fontSize + 3,
  value,
  width,
  x,
  y,
}: {
  bold?: boolean;
  fontSize?: number;
  lineHeight?: number;
  value: string;
  width: number;
  x: number;
  y: number;
}) {
  const lines = wrapText(value, width, fontSize);
  return {
    commands: lines.map((lineValue, index) =>
      textLine(lineValue, x, y - index * lineHeight, { bold, fontSize }),
    ),
    height: lines.length * lineHeight,
  };
}

function fieldHeight(value: string, width = FIELD_COLUMN_WIDTH) {
  return 10 + wrapText(value, width, 8.2).length * 11.2;
}

function fieldCommands({
  label,
  value,
  width = FIELD_COLUMN_WIDTH,
  x,
  y,
}: {
  label: string;
  value: string;
  width?: number;
  x: number;
  y: number;
}) {
  const wrapped = wrappedTextCommands({
    fontSize: 8.2,
    lineHeight: 11.2,
    value,
    width,
    x,
    y: y - 10,
  });

  return [
    textLine(label.toUpperCase(), x, y, {
      bold: true,
      fontSize: 6.8,
    }),
    ...wrapped.commands,
  ];
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

function rowHeight(row: CommissionStatementPdfRow) {
  const clientHeight = wrapText(cleanText(row.client_name), 325, 9.8).length * 13;
  const firstLineHeight = Math.max(clientHeight, 20);
  const detailRows = [
    Math.max(
      fieldHeight(cleanText(row.policy_number)),
      fieldHeight(row.vehicle_no ? cleanText(row.vehicle_no) : "-"),
    ),
    Math.max(
      fieldHeight(cleanText(row.insurance_type)),
      fieldHeight(cleanText(row.insurer_name)),
    ),
    Math.max(fieldHeight(termText(row)), fieldHeight(money(row.gross_premium))),
    Math.max(fieldHeight(percent(row.calculation_percent)), fieldHeight(money(row.amount))),
  ];
  return 30 + firstLineHeight + detailRows.reduce((sum, height) => sum + height + FIELD_GAP, 0);
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
    rect(0, PAGE_HEIGHT - 112, PAGE_WIDTH, 112, [0.93, 0.97, 1]),
    textLine("Kover", MARGIN, PAGE_HEIGHT - 38, { bold: true, fontSize: 12 }),
    textLine("Commission Statement", MARGIN, PAGE_HEIGHT - 64, { bold: true, fontSize: 20 }),
    textLine(`Payee: ${payeeName}`, MARGIN, PAGE_HEIGHT - 86, { fontSize: 10 }),
    textLine(`Statement ${statementIndex}`, MARGIN, PAGE_HEIGHT - 102, { fontSize: 8 }),
    textLine(`Paid date: ${formatDate(paidDate)}`, PAGE_WIDTH - MARGIN - 190, PAGE_HEIGHT - 44, {
      align: "right",
      fontSize: 10,
      width: 190,
    }),
    textLine(`Total: ${money(total)}`, PAGE_WIDTH - MARGIN - 190, PAGE_HEIGHT - 67, {
      align: "right",
      bold: true,
      fontSize: 12,
      width: 190,
    }),
    textLine(`Page ${pageIndex + 1} of ${pageTotal}`, PAGE_WIDTH - MARGIN - 190, PAGE_HEIGHT - 87, {
      align: "right",
      fontSize: 8,
      width: 190,
    }),
  ];
}

function rowCommands(row: CommissionStatementPdfRow, index: number, topY: number) {
  const height = rowHeight(row);
  const bottomY = topY - height;
  const commands: PdfCommand[] = [
    rect(MARGIN, bottomY, CONTENT_WIDTH, height - 6, [0.985, 0.992, 1]),
    strokeRect(MARGIN, bottomY, CONTENT_WIDTH, height - 6, [0.84, 0.9, 0.95]),
  ];

  commands.push(
    textLine(String(index + 1), MARGIN + 12, topY - 23, {
      bold: true,
      fontSize: 9,
    }),
  );

  const client = wrappedTextCommands({
    bold: true,
    fontSize: 9.8,
    lineHeight: 13,
    value: cleanText(row.client_name),
    width: 325,
    x: MARGIN + 40,
    y: topY - 20,
  });
  commands.push(...client.commands);
  commands.push(
    textLine(money(row.amount), PAGE_WIDTH - MARGIN - 130, topY - 21, {
      align: "right",
      bold: true,
      fontSize: 10.5,
      width: 130,
    }),
  );

  let y = topY - 30 - Math.max(client.height, 20);
  const leftX = MARGIN + 16;
  const rightX = MARGIN + 16 + FIELD_COLUMN_WIDTH + COLUMN_GAP;
  const detailRows = [
    [
      { label: "Policy No", value: cleanText(row.policy_number) },
      { label: "Vehicle No", value: row.vehicle_no ? cleanText(row.vehicle_no) : "-" },
    ],
    [
      { label: "Risk", value: cleanText(row.insurance_type) },
      { label: "Insurer", value: cleanText(row.insurer_name) },
    ],
    [
      { label: "Term", value: termText(row) },
      { label: "Gross Premium", value: money(row.gross_premium) },
    ],
    [
      { label: "Commission Rate", value: percent(row.calculation_percent) },
      { label: "Commission Amount", value: money(row.amount) },
    ],
  ];

  for (const [left, right] of detailRows) {
    commands.push(...fieldCommands({ ...left, x: leftX, y }));
    commands.push(...fieldCommands({ ...right, x: rightX, y }));
    y -=
      Math.max(fieldHeight(left.value), fieldHeight(right.value)) +
      FIELD_GAP;
  }

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
      fontSize: 7.5,
    }),
    textLine("Confirm payment only after the actual payment is made.", PAGE_WIDTH - MARGIN - 245, 42, {
      align: "right",
      fontSize: 7.5,
      width: 245,
    }),
  ];
}

function buildStatementPages(input: CommissionStatementPdfInput, statementIndex: number) {
  const rows = sortedStatementRows(input.rows);
  const total = statementTotal(rows);
  const availableHeight = HEADER_BOTTOM_Y - FOOTER_Y - 24;

  const rowPages: CommissionStatementPdfRow[][] = [];
  let pageRows: CommissionStatementPdfRow[] = [];
  let pageHeight = 0;
  for (const row of rows) {
    const height = rowHeight(row);
    if (pageRows.length && pageHeight + height > availableHeight) {
      rowPages.push(pageRows);
      pageRows = [];
      pageHeight = 0;
    }
    pageRows.push(row);
    pageHeight += height;
  }
  rowPages.push(pageRows);

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
    ];

    let y = HEADER_BOTTOM_Y;
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
