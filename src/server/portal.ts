import { db } from "@/lib/db";
import type { Me } from "@/lib/guard";

/** Các học viên mà tài khoản học viên/phụ huynh được xem, và học viên đang chọn (?child=). */
export async function portalKids(me: Me, child?: string) {
  const kids = me.role === "STUDENT"
    ? await db.student.findMany({ where: { userId: me.id }, orderBy: { fullName: "asc" } })
    : await db.student.findMany({ where: { parent: { userId: me.id } }, orderBy: { fullName: "asc" } });
  const kid = kids.find((k) => k.id === child) ?? kids[0] ?? null;
  return { kids, kid };
}
