import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createPdf, wrapText } from "@/server/pdf-kit";
import { fmtDate, WEEKDAYS } from "@/lib/format";

export type SchedulePdfData = {
  centerName: string;
  student: { code: string; fullName: string; gradeLevel?: string | null };
  classes: { name: string; teacher: string; weekly: string; status: string }[];
  sessions: { date: Date; time: string; className: string; room: string; teacher: string; status: string }[];
};

/** Lịch học của học viên (A4): các lớp đang học và danh sách buổi học sắp tới. */
export async function buildSchedulePdf(d: SchedulePdfData): Promise<Uint8Array> {
  const { pdf, reg, bold } = await createPdf();
  pdf.setTitle(`Lịch học ${d.student.fullName}`);
  const W = 595.28, H = 841.89, M = 48, R = W - M;
  const ink = rgb(0.1, 0.12, 0.17), grey = rgb(0.4, 0.43, 0.5), line = rgb(0.8, 0.82, 0.86);
  let page!: PDFPage, y = 0, n = 0;

  const text = (s: string, x: number, size: number, f: PDFFont = reg, color = ink) => page.drawText(s, { x, y, size, font: f, color });
  const newPage = () => {
    page = pdf.addPage([W, H]); n++; y = H - 52;
    text(d.centerName.toUpperCase(), M, 11, bold); y -= 14;
    page.drawLine({ start: { x: M, y }, end: { x: R, y }, thickness: 0.7, color: line }); y -= 26;
  };
  const head = (cols: [string, number][]) => {
    page.drawRectangle({ x: M, y: y - 6, width: R - M, height: 22, color: rgb(0.94, 0.95, 0.97) });
    for (const [s, x] of cols) text(s, x, 9.5, bold);
    y -= 24;
  };

  newPage();
  const title = "LỊCH HỌC CỦA HỌC VIÊN";
  page.drawText(title, { x: (W - bold.widthOfTextAtSize(title, 16)) / 2, y, size: 16, font: bold, color: ink }); y -= 22;
  const who = `${d.student.fullName} (${d.student.code})${d.student.gradeLevel ? ` · ${d.student.gradeLevel}` : ""}`;
  page.drawText(who, { x: (W - reg.widthOfTextAtSize(who, 10.5)) / 2, y, size: 10.5, font: reg, color: ink }); y -= 28;

  text("Các lớp đang theo học", M, 10.5, bold); y -= 20;
  const cx = [M + 8, M + 190, M + 330];
  head([["Lớp", cx[0]], ["Giáo viên", cx[1]], ["Lịch hằng tuần", cx[2]]]);
  for (const c of d.classes) {
    const a = wrapText(c.name, reg, 10, 170), b = wrapText(c.teacher, reg, 10, 130), w = wrapText(c.weekly || "-", reg, 9.5, R - cx[2] - 6);
    const rows = Math.max(a.length, b.length, w.length);
    a.forEach((l, i) => page.drawText(l, { x: cx[0], y: y - i * 13, size: 10, font: reg, color: ink }));
    b.forEach((l, i) => page.drawText(l, { x: cx[1], y: y - i * 13, size: 10, font: reg, color: ink }));
    w.forEach((l, i) => page.drawText(l, { x: cx[2], y: y - i * 13, size: 9.5, font: reg, color: ink }));
    y -= rows * 13 + 5;
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: R, y: y + 8 }, thickness: 0.5, color: line });
    y -= 5;
  }
  if (!d.classes.length) { text("Chưa có lớp.", M + 8, 10, reg, grey); y -= 18; }
  y -= 14;

  text("Các buổi học sắp tới", M, 10.5, bold); y -= 20;
  const sx = [M + 6, M + 106, M + 176, M + 296, M + 396];
  const fit = (t: string, maxW: number) => { let o = t; while (o.length > 1 && reg.widthOfTextAtSize(o, 9) > maxW) o = o.slice(0, -1); return o === t ? t : o.trimEnd() + "…"; };
  const sessionHead = () => head([["Ngày", sx[0]], ["Giờ", sx[1]], ["Lớp", sx[2]], ["Phòng", sx[3]], ["Giáo viên", sx[4]]]);
  sessionHead();
  for (const s of d.sessions) {
    if (y < 80) { newPage(); sessionHead(); }
    const wd = WEEKDAYS[s.date.getUTCDay()];
    text(`${wd}, ${fmtDate(s.date)}`, sx[0], 9);
    text(s.time, sx[1], 9);
    text(fit(s.className, sx[3] - sx[2] - 6), sx[2], 9);
    text(fit(s.room || "-", sx[4] - sx[3] - 6), sx[3], 9);
    text(fit(s.teacher || "-", R - sx[4]), sx[4], 9);
    y -= 17;
    page.drawLine({ start: { x: M, y: y + 11 }, end: { x: R, y: y + 11 }, thickness: 0.4, color: line });
  }
  if (!d.sessions.length) { text("Chưa có buổi học nào được xếp.", M + 8, 10, reg, grey); y -= 18; }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Lập ngày ${fmtDate(new Date(Date.now() + 7 * 3600_000))} bằng phần mềm ZenClass · Trang ${i + 1}/${pages.length}`, { x: M, y: 36, size: 8, font: reg, color: grey });
  });
  void n;
  return pdf.save();
}
