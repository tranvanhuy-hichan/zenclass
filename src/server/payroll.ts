import { toMinutes } from "@/lib/format";

export type PayTeacher = { payType: string; payRate: number; substituteRate?: number };
export type PaySession = {
  startTime: string; endTime: string;
  originalTeacherId?: string | null; // có giá trị = buổi dạy thế
  payAmount?: number | null; // thù lao riêng của buổi
  class?: { teacherRate: number | null } | null; // đơn giá riêng của lớp
};

const hoursOf = (s: PaySession) => (toMinutes(s.endTime) - toMinutes(s.startTime)) / 60;

/**
 * Thù lao 1 buổi dạy, theo thứ tự ưu tiên:
 * 1) Buổi có thù lao riêng (payAmount)            → dùng đúng số đó
 * 2) Buổi dạy thế                                  → đơn giá dạy thế; nếu chưa khai báo thì dùng mức lương thường (lương cố định: 0)
 * 3) Buổi dạy thường                               → đơn giá riêng của lớp; nếu không có thì mức lương của giáo viên (lương cố định: 0, đã trả theo tháng)
 * Đơn vị tính theo kiểu lương: theo buổi = số tiền/buổi; theo giờ = số tiền/giờ × số giờ.
 */
export function sessionPay(t: PayTeacher, s: PaySession) {
  if (s.payAmount != null) return s.payAmount;
  const sub = !!s.originalTeacherId;
  let rate: number;
  if (sub) rate = t.substituteRate && t.substituteRate > 0 ? t.substituteRate : t.payType === "FIXED" ? 0 : t.payRate;
  else rate = t.payType === "FIXED" ? 0 : s.class?.teacherRate ?? t.payRate;
  return t.payType === "PER_HOUR" ? Math.round(rate * hoursOf(s)) : rate;
}

export function computePay(t: PayTeacher, sessions: PaySession[]) {
  const hours = sessions.reduce((h, s) => h + hoursOf(s), 0);
  let regular = t.payType === "FIXED" ? t.payRate : 0;
  let substitute = 0, subCount = 0;
  for (const s of sessions) {
    const a = sessionPay(t, s);
    if (s.originalTeacherId) { substitute += a; subCount++; } else regular += a;
  }
  // "base" = lương thường (+ lương cố định tháng); "substitute" = tiền dạy thế
  return { sessions: sessions.length, hours, base: regular, substitute, subCount, total: regular + substitute };
}

export const PAY_LABEL: Record<string, string> = { PER_SESSION: "Theo buổi", PER_HOUR: "Theo giờ", FIXED: "Cố định/tháng" };

export function monthRange(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return { from: new Date(Date.UTC(y, mo - 1, 1)), to: new Date(Date.UTC(y, mo, 1)), y, mo };
}
