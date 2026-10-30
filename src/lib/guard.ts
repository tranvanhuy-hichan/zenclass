import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export type Role = "SUPERADMIN" | "ADMIN" | "STAFF" | "TEACHER" | "STUDENT" | "PARENT";
export type Me = { id: string; name: string; role: Role; tenantId: string | null };

export async function getMe(): Promise<Me | null> {
  const s = await getServerSession(authOptions);
  const u = s?.user as { id?: string; name?: string; role?: Role; tenantId?: string | null } | undefined;
  return u?.id ? { id: u.id, name: u.name ?? "", role: u.role!, tenantId: u.tenantId ?? null } : null;
}

/** Dùng trong page: chuyển hướng nếu chưa đăng nhập / sai quyền. */
export async function requireRole(...roles: Role[]): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login");
  if (roles.length && !roles.includes(me.role)) redirect("/");
  return me;
}

/** Dùng trong server action: ném lỗi nếu sai quyền. */
export async function assertRole(...roles: Role[]): Promise<Me> {
  const me = await getMe();
  if (!me || (roles.length && !roles.includes(me.role))) throw new Error("Không có quyền");
  return me;
}

export const STAFF_ROLES: Role[] = ["ADMIN", "STAFF"];

/** Tài khoản vai trò TEACHER có thể là giáo viên hoặc trợ giảng. */
export async function teachingIds(userId: string) {
  const { db } = await import("@/lib/db");
  const [t, a, c] = await Promise.all([db.teacher.findUnique({ where: { userId } }), db.assistant.findUnique({ where: { userId } }), db.coordinator.findUnique({ where: { userId } })]);
  return { teacherId: t?.id ?? null, assistantId: a?.id ?? null, coordinatorId: c?.id ?? null };
}
