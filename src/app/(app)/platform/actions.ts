"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rootDb, withTenant } from "@/lib/db";
import { assertRole } from "@/lib/guard";
import { wrap, str, int } from "@/lib/action";
import { createUser, resetPassword } from "@/server/accounts";
import { getSettings, saveSettings } from "@/lib/settings";

const RESERVED = new Set(["admin", "api", "www", "app", "platform", "login", "superadmin", "root", "static"]);
const PLANS = { TRIAL: { maxStudents: 50, maxBranches: 1 }, BASIC: { maxStudents: 150, maxBranches: 1 }, PRO: { maxStudents: 600, maxBranches: 5 }, ENTERPRISE: { maxStudents: 100000, maxBranches: 100 } } as const;
type Plan = keyof typeof PLANS;

/** Tạo trung tâm + tài khoản quản trị đầu tiên (mật khẩu ngẫu nhiên, bắt đổi lần đầu). */
export const createTenant = wrap(async (fd) => {
  await assertRole("SUPERADMIN");
  const name = str(fd, "name"), slug = str(fd, "slug").toLowerCase();
  const adminName = str(fd, "adminName") || "Quản trị trung tâm";
  const adminUser = (str(fd, "adminUser") || `admin-${slug}`).toLowerCase();
  const plan = (str(fd, "plan") in PLANS ? str(fd, "plan") : "TRIAL") as Plan;
  if (!name) throw new Error("Nhập tên trung tâm");
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(slug) || RESERVED.has(slug)) throw new Error("Mã trung tâm gồm 3–30 ký tự chữ thường, số hoặc dấu gạch ngang");
  if (await rootDb.tenant.findUnique({ where: { slug } })) throw new Error("Mã trung tâm đã được dùng");
  const days = int(fd, "days", plan === "TRIAL" ? 14 : 365);
  const t = await rootDb.tenant.create({
    data: { slug, name, plan, ...PLANS[plan], expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000) : null, note: str(fd, "note") || null },
  });
  const { password } = await withTenant(t.id, async () => {
    const r = await createUser("ADMIN", adminUser, adminName);
    await saveSettings({ ...(await getSettings()), name });
    return r;
  });
  revalidatePath("/platform");
  return `Đã tạo trung tâm "${name}".\nTài khoản quản trị: ${adminUser}\nMật khẩu: ${password} (chỉ hiện một lần, người dùng sẽ phải đổi khi đăng nhập lần đầu)`;
});

export const updateTenant = wrap(async (fd) => {
  await assertRole("SUPERADMIN");
  const id = str(fd, "id");
  const plan = (str(fd, "plan") in PLANS ? str(fd, "plan") : "TRIAL") as Plan;
  const exp = str(fd, "expiresAt");
  await rootDb.tenant.update({
    where: { id },
    data: {
      name: str(fd, "name"), plan, status: str(fd, "status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
      expiresAt: exp ? new Date(exp + "T23:59:59Z") : null,
      maxStudents: int(fd, "maxStudents", PLANS[plan].maxStudents), maxBranches: int(fd, "maxBranches", PLANS[plan].maxBranches),
      note: str(fd, "note") || null,
    },
  });
  revalidatePath("/platform"); revalidatePath(`/platform/${id}`);
});

/** Cấp lại mật khẩu cho một tài khoản quản trị của trung tâm. */
export const resetTenantAdmin = wrap(async (fd) => {
  await assertRole("SUPERADMIN");
  const id = str(fd, "tenantId");
  const admin = await rootDb.user.findFirst({ where: { tenantId: id, role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("Trung tâm chưa có tài khoản quản trị");
  const pw = await withTenant(id, () => resetPassword(admin.id));
  return `Tài khoản ${admin.username} · Mật khẩu mới: ${pw}`;
});

export const deleteTenant = wrap(async (fd) => {
  await assertRole("SUPERADMIN");
  const id = str(fd, "id");
  if (str(fd, "confirm") !== (await rootDb.tenant.findUniqueOrThrow({ where: { id } })).slug) throw new Error("Gõ đúng mã trung tâm để xác nhận xoá");
  const tables = (await rootDb.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.columns WHERE column_name = 'tenantId' AND table_schema = 'public'`).map((r) => r.table_name);
  // xoá lần lượt, lặp lại để vượt qua ràng buộc khoá ngoại
  for (let round = 0; round < 6 && tables.length; round++) {
    for (const t of [...tables]) {
      try { await rootDb.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "tenantId" = $1`, id); tables.splice(tables.indexOf(t), 1); } catch { /* thử lại vòng sau */ }
    }
  }
  if (tables.length) throw new Error("Không xoá hết dữ liệu: " + tables.join(", "));
  await rootDb.tenant.delete({ where: { id } });
  revalidatePath("/platform");
  redirect("/platform");
});
