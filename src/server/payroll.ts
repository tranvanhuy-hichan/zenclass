import { toMinutes } from "@/lib/format";

export type PayTeacher = { payType: string; payRate: number };
export type PaySession = { startTime: string; endTime: string };

export function computePay(t: PayTeacher, sessions: PaySession[]) {
  const hours = sessions.reduce((h, s) => h + (toMinutes(s.endTime) - toMinutes(s.startTime)) / 60, 0);
  const base = t.payType === "FIXED" ? t.payRate : t.payType === "PER_HOUR" ? Math.round(hours * t.payRate) : sessions.length * t.payRate;
  return { sessions: sessions.length, hours, base };
}

export const PAY_LABEL: Record<string, string> = { PER_SESSION: "Theo buổi", PER_HOUR: "Theo giờ", FIXED: "Cố định/tháng" };

export function monthRange(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return { from: new Date(Date.UTC(y, mo - 1, 1)), to: new Date(Date.UTC(y, mo, 1)), y, mo };
}
