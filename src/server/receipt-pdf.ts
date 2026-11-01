import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fmtDate, moneyToWords } from "@/lib/format";

const METHOD = { CASH: "Tiền mặt", BANK: "Chuyển khoản", QR: "Quét QR" } as const;

export type ReceiptData = {
  center: { name: string; address?: string; phone?: string; taxCode?: string };
  no: string; // số biên lai
  date: Date;
  student: { code: string; fullName: string; gradeLevel?: string | null };
  payer: string;
  invoiceCode: string;
  items: { description: string; amount: number }[];
  total: number;
  paidAll: number;
  payments: { paidAt: Date; method: keyof typeof METHOD; amount: number }[];
  receivedAmount: number; // số tiền của biên lai này (một khoản thu hoặc tổng đã thu)
};

const fontFile = (n: string) => readFile(path.join(process.cwd(), "src/assets/fonts", n));
const money = (n: number) => n.toLocaleString("vi-VN") + " đ";

/** Biên lai thu tiền học phí, khổ A4, font nhúng đủ dấu tiếng Việt. */
export async function buildReceiptPdf(d: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [reg, bold] = await Promise.all([pdf.embedFont(await fontFile("DejaVuSans.ttf"), { subset: true }), pdf.embedFont(await fontFile("DejaVuSans-Bold.ttf"), { subset: true })]);
  pdf.setTitle(`Biên lai ${d.no}`);
  pdf.setProducer("ZenClass");
  pdf.setCreationDate(new Date());

  const page = pdf.addPage([595.28, 841.89]);
  const W = page.getWidth(), M = 48, R = W - M;
  const ink = rgb(0.1, 0.12, 0.17), grey = rgb(0.4, 0.43, 0.5), line = rgb(0.8, 0.82, 0.86);
  let y = 841.89 - 52;

  const text = (s: string, x: number, size: number, f: PDFFont = reg, color = ink) => page.drawText(s, { x, y, size, font: f, color });
  const right = (s: string, xr: number, size: number, f: PDFFont = reg) => page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y, size, font: f, color: ink });
  const center = (s: string, size: number, f: PDFFont = bold) => page.drawText(s, { x: (W - f.widthOfTextAtSize(s, size)) / 2, y, size, font: f, color: ink });
  const rule = (yy: number, c = line) => page.drawLine({ start: { x: M, y: yy }, end: { x: R, y: yy }, thickness: 0.7, color: c });
  const wrap = (s: string, f: PDFFont, size: number, maxW: number) => {
    const out: string[] = [];
    let cur = "";
    for (const w of s.split(/\s+/)) {
      const t = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > maxW && cur) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur);
    return out.length ? out : [""];
  };

  // ===== Đầu trang: thông tin đơn vị thu =====
  for (const l of wrap(d.center.name.toUpperCase(), bold, 12, 330)) { text(l, M, 12, bold); y -= 16; }
  if (d.center.address) for (const l of wrap(`Địa chỉ: ${d.center.address}`, reg, 9, 330)) { text(l, M, 9, reg, grey); y -= 13; }
  if (d.center.phone) { text(`Điện thoại: ${d.center.phone}`, M, 9, reg, grey); y -= 13; }
  if (d.center.taxCode) { text(`Mã số thuế: ${d.center.taxCode}`, M, 9, reg, grey); y -= 13; }
  const top = 841.89 - 52;
  page.drawText("Mẫu số: 01-BL/HP", { x: R - reg.widthOfTextAtSize("Mẫu số: 01-BL/HP", 9), y: top, size: 9, font: reg, color: grey });
  page.drawText(`Số: ${d.no}`, { x: R - bold.widthOfTextAtSize(`Số: ${d.no}`, 10), y: top - 15, size: 10, font: bold, color: ink });

  y -= 14;
  rule(y); y -= 34;
  center("BIÊN LAI THU TIỀN HỌC PHÍ", 17); y -= 18;
  center(`Ngày ${String(d.date.getUTCDate()).padStart(2, "0")} tháng ${String(d.date.getUTCMonth() + 1).padStart(2, "0")} năm ${d.date.getUTCFullYear()}`, 10, reg); y -= 30;

  // ===== Người nộp / học viên =====
  const info: [string, string][] = [
    ["Người nộp tiền", d.payer],
    ["Học viên", `${d.student.fullName} (${d.student.code})${d.student.gradeLevel ? ` · ${d.student.gradeLevel}` : ""}`],
    ["Nội dung", `Thu học phí theo phiếu ${d.invoiceCode}`],
  ];
  for (const [k, v] of info) {
    text(`${k}:`, M, 10, reg, grey);
    const ls = wrap(v, bold, 10, R - M - 100);
    for (const l of ls) { text(l, M + 100, 10, bold); y -= 15; }
  }
  y -= 8;

  // ===== Bảng khoản thu =====
  const colAmt = R, colDesc = M + 34;
  const header = (cols: [string, number, "l" | "r"][]) => {
    page.drawRectangle({ x: M, y: y - 6, width: R - M, height: 22, color: rgb(0.94, 0.95, 0.97) });
    for (const [s, x, a] of cols) { if (a === "l") text(s, x, 9.5, bold); else right(s, x, 9.5, bold); }
    y -= 24;
  };
  header([["STT", M + 8, "l"], ["Nội dung khoản thu", colDesc, "l"], ["Thành tiền", colAmt - 8, "r"]]);
  d.items.forEach((it, i) => {
    const ls = wrap(it.description, reg, 10, colAmt - colDesc - 110);
    text(String(i + 1), M + 8, 10);
    ls.forEach((l, j) => { text(l, colDesc, 10); if (j === 0) right((it.amount < 0 ? "-" : "") + money(Math.abs(it.amount)), colAmt - 8, 10); y -= 18; });
    rule(y + 11);
  });
  y -= 4;
  right("Tổng học phí:", colAmt - 130, 10, reg); right(money(d.total), colAmt - 8, 10, bold); y -= 16;
  right("Đã thanh toán (luỹ kế):", colAmt - 130, 10, reg); right(money(d.paidAll), colAmt - 8, 10, bold); y -= 16;
  right("Còn nợ:", colAmt - 130, 10, reg); right(money(Math.max(d.total - d.paidAll, 0)), colAmt - 8, 10, bold); y -= 26;

  // ===== Số tiền biên lai này =====
  page.drawRectangle({ x: M, y: y - 36, width: R - M, height: 48, color: rgb(0.95, 0.97, 0.99), borderColor: line, borderWidth: 0.7 });
  y -= 6;
  text("SỐ TIỀN ĐÃ THU", M + 12, 9, bold, grey); right(money(d.receivedAmount), R - 12, 15, bold); y -= 16;
  const words = wrap(`Bằng chữ: ${moneyToWords(d.receivedAmount)}`, reg, 9.5, R - M - 24);
  for (const l of words) { text(l, M + 12, 9.5, reg); y -= 13; }
  y -= 18;

  // ===== Lịch sử thanh toán =====
  if (d.payments.length) {
    text("Chi tiết thanh toán", M, 10, bold); y -= 20;
    header([["Ngày", M + 8, "l"], ["Hình thức", M + 130, "l"], ["Số tiền", colAmt - 8, "r"]]);
    for (const p of d.payments) {
      text(fmtDate(p.paidAt), M + 8, 10); text(METHOD[p.method], M + 130, 10); right(money(p.amount), colAmt - 8, 10); y -= 18;
      rule(y + 11);
    }
    y -= 14;
  }

  // ===== Chữ ký =====
  y = Math.min(y, 230);
  const half = (R - M) / 2;
  const sign = (title: string, x: number) => {
    const w = bold.widthOfTextAtSize(title, 10);
    page.drawText(title, { x: x + (half - w) / 2, y, size: 10, font: bold, color: ink });
    const note = "(Ký, ghi rõ họ tên)";
    page.drawText(note, { x: x + (half - reg.widthOfTextAtSize(note, 8.5)) / 2, y: y - 13, size: 8.5, font: reg, color: grey });
  };
  sign("Người nộp tiền", M); sign("Người thu tiền", M + half);

  // ===== Chân trang =====
  drawFooter(page, reg, d, grey, line);
  return pdf.save();
}

function drawFooter(page: PDFPage, reg: PDFFont, d: ReceiptData, grey: ReturnType<typeof rgb>, line: ReturnType<typeof rgb>) {
  const W = page.getWidth(), M = 48;
  page.drawLine({ start: { x: M, y: 60 }, end: { x: W - M, y: 60 }, thickness: 0.7, color: line });
  const s = `Biên lai ${d.no} · lập bằng phần mềm ZenClass · có giá trị xác nhận khoản đã thu của ${d.center.name}`;
  page.drawText(s, { x: M, y: 44, size: 8, font: reg, color: grey, maxWidth: W - 2 * M });
}
