import { currentTenantId, db, rootDb } from "@/lib/db";

/** Chặn thêm vượt giới hạn của gói dịch vụ. */
export async function assertQuota(kind: "students" | "branches", adding = 1) {
  const id = await currentTenantId();
  if (!id) return;
  const t = await rootDb.tenant.findUnique({ where: { id } });
  if (!t) return;
  if (kind === "students") {
    const n = await db.student.count({ where: { dropped: false } });
    if (n + adding > t.maxStudents) throw new Error(`Gói dịch vụ chỉ cho tối đa ${t.maxStudents} học viên (đang có ${n}). Vui lòng liên hệ để nâng cấp gói.`);
  } else {
    const n = await db.branch.count();
    if (n + adding > t.maxBranches) throw new Error(`Gói dịch vụ chỉ cho tối đa ${t.maxBranches} cơ sở. Vui lòng liên hệ để nâng cấp gói.`);
  }
}
