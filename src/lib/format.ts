export const WEEKDAYS = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export function parseDate(s: string) {
  return new Date(s + "T00:00:00.000Z");
}
export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;
}
export function todayUTC() {
  const n = new Date(Date.now() + 7 * 3600_000); // giờ Việt Nam
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}
export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400_000);
}
export function mondayOf(d: Date) {
  const wd = (d.getUTCDay() + 6) % 7;
  return addDays(d, -wd);
}
export function fmtMoney(n: number) {
  return n.toLocaleString("vi-VN") + " đ";
}
export function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function overlaps(a1: string, a2: string, b1: string, b2: string) {
  return toMinutes(a1) < toMinutes(b2) && toMinutes(b1) < toMinutes(a2);
}

const D = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
function three(n: number, full: boolean) {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  const out: string[] = [];
  if (h > 0 || full) out.push(D[h], "trăm");
  if (t > 1) out.push(D[t], "mươi");
  else if (t === 1) out.push("mười");
  else if (h > 0 || full) if (u > 0) out.push("lẻ");
  if (u > 0) {
    if (t > 1 && u === 1) out.push("mốt");
    else if (t >= 1 && u === 5) out.push("lăm");
    else out.push(D[u]);
  }
  return out.join(" ");
}
export function moneyToWords(n: number) {
  if (n === 0) return "Không đồng";
  const units = ["", "nghìn", "triệu", "tỷ"];
  const parts: string[] = [];
  let i = 0, first = true;
  while (n > 0) {
    const g = n % 1000;
    n = Math.floor(n / 1000);
    if (g > 0) parts.unshift((three(g, n > 0) + " " + units[i % 4]).trim());
    i++;
    first = false;
  }
  void first;
  const s = parts.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1) + " đồng";
}

/** Giờ hiện tại theo múi giờ Việt Nam, dạng "thời điểm giả UTC" để so sánh với date + giờ buổi học. */
export function nowVN() {
  return new Date(Date.now() + 7 * 3600_000);
}
/** Buổi học (ngày UTC + giờ kết thúc "HH:MM") đã kết thúc chưa? */
export function sessionEnded(date: Date, endTime: string, now = nowVN()) {
  const [h, m] = endTime.split(":").map(Number);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, m) < now.getTime();
}

/** "P101 · Cầu Giấy" — tên phòng kèm cơ sở (bỏ tiền tố "Cơ sở"). */
export function roomLabel(r: { name: string; branch?: { name: string } | null } | null | undefined) {
  if (!r) return null;
  return r.branch ? `${r.name} · ${r.branch.name.replace(/^Cơ sở\s+/i, "")}` : r.name;
}
