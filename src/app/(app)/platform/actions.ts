"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rootDb, withTenant } from "@/lib/db";
import { assertRole } from "@/lib/guard";
import { wrap, str, int } from "@/lib/action";
import { createUser, resetPassword } from "@/server/accounts";
import { addMonths, getPlatformCfg, PLAN_ORDER, type PlanCode, type PlatformCfg } from "@/lib/plans";
import { getSettings, saveSettings } from "@/lib/settings";

const RESERVED = new Set(["admin", "api", "www", "app", "platform", "login", "superadmin", "root", "static"]);

/** Tạo trung tâm + tài khoản quản trị đầu tiên (mật khẩu ngẫu nhiên, bắt đổi lần đầu). */
export const createTenant = wrap(async (fd) => {
  await assertRole("SUPERADMIN");
  const name = str(fd, "name"), slug = str(fd, "slug").toLowerCase();
  const adminName = str(fd, "adminName") || "Quản trị trung tâm";
  const adminUser = (str(fd, "adminUser") || `admin-${slug}`).toLowerCase();
  const cfg = await getPlatformCfg();
  const plan = (PLAN_ORDER.includes(str(fd, "plan") as PlanCode) ? str(fd, "plan") : "TRIAL") as PlanCode;
  if (!name) throw new Error("Nhập tên trung tâm");
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(slug) || RESERVED.has(slug)) throw new Error("Mã trung tâm gồm 3–30 ký tự chữ thường, số hoặc dấu gạch ngang");
  if (await rootDb.tenant.findUnique({ where: { slug } })) throw new Error("Mã trung tâm đã được dùng");
  const days = int(fd, "days", plan === "TRIAL" ? 14 : 365);
  const t = await rootDb.tenant.create({
    data: { slug, name, plan, maxStudents: cfg.plans[plan].maxStudents, maxBranches: cfg.plans[plan].maxBranches, expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000) : null, note: str(fd, "note") || null },
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
  const cfg = await getPlatformCfg();
  const plan = (PLAN_ORDER.includes(str(fd, "plan") as PlanCode) ? str(fd, "plan") : "TRIAL") as PlanCode;
  const exp = str(fd, "expiresAt");
  await rootDb.tenant.update({
    where: { id },
    data: {
      name: str(fd, "name"), plan, status: str(fd, "status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
      expiresAt: exp ? new Date(exp + "T23:59:59Z") : null,
      maxStudents: int(fd, "maxStudents", cfg.plans[plan].maxStudents), maxBranches: int(fd, "maxBranches", cfg.plans[plan].maxBranches),
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

/** Áp dụng một đơn đã thanh toán: đổi gói, cộng thời hạn (tính từ hạn hiện tại nếu còn hạn). */
async function applyOrder(orderId: string) {
  const o = await rootDb.tenantOrder.findUniqueOrThrow({ where: { id: orderId } });
  if (o.status === "PAID") throw new Error("Đơn này đã được xác nhận trước đó");
  const cfg = await getPlatformCfg();
  const t = await rootDb.tenant.findUniqueOrThrow({ where: { id: o.tenantId } });
  const plan = o.plan as PlanCode;
  const start = t.expiresAt && t.expiresAt > new Date() && t.plan === plan ? t.expiresAt : new Date();
  await rootDb.$transaction([
    rootDb.tenant.update({ where: { id: t.id }, data: { plan, status: "ACTIVE", expiresAt: addMonths(start, o.months), maxStudents: cfg.plans[plan].maxStudents, maxBranches: cfg.plans[plan].maxBranches } }),
    rootDb.tenantOrder.update({ where: { id: o.id }, data: { status: "PAID", paidAt: new Date() } }),
  ]);
  return { tenantId: t.id, name: t.name };
}

export const confirmOrder = wrap(async (fd) => {
  await assertRole("SUPERADMIN");
  const r = await applyOrder(str(fd, "id"));
  revalidatePath("/platform", "layout");
  return `Đã xác nhận, ${r.name} đã được cập nhật gói và hạn dùng`;
});

export const cancelOrder = wrap(async (fd) => {
  await assertRole("SUPERADMIN");
  const o = await rootDb.tenantOrder.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  if (o.status !== "PENDING") throw new Error("Chỉ huỷ được đơn đang chờ thanh toán");
  await rootDb.tenantOrder.update({ where: { id: o.id }, data: { status: "CANCELLED" } });
  revalidatePath("/platform", "layout");
});

/** Tặng thêm thời hạn (không thu tiền), vd khuyến mãi hoặc bù lỗi. */
export const grantMonths = wrap(async (fd) => {
  await assertRole("SUPERADMIN");
  const id = str(fd, "id"), months = int(fd, "months", 1);
  if (months < 1 || months > 36) throw new Error("Số tháng không hợp lệ");
  const t = await rootDb.tenant.findUniqueOrThrow({ where: { id } });
  const start = t.expiresAt && t.expiresAt > new Date() ? t.expiresAt : new Date();
  await rootDb.tenant.update({ where: { id }, data: { expiresAt: addMonths(start, months), status: "ACTIVE" } });
  revalidatePath("/platform", "layout");
  return `Đã cộng ${months} tháng`;
});

export const saveConfig = wrap(async (fd) => {
  await assertRole("SUPERADMIN");
  const cur = await getPlatformCfg();
  const plans = { ...cur.plans };
  for (const k of PLAN_ORDER) {
    plans[k] = { ...cur.plans[k], name: str(fd, `${k}.name`) || cur.plans[k].name, monthlyPrice: int(fd, `${k}.price`, cur.plans[k].monthlyPrice), maxStudents: int(fd, `${k}.students`, cur.plans[k].maxStudents), maxBranches: int(fd, `${k}.branches`, cur.plans[k].maxBranches), features: str(fd, `${k}.features`).split("\n").map((x) => x.trim()).filter(Boolean) };
  }
  const pct = (m: string) => Math.min(90, Math.max(0, int(fd, `d${m}`, 0)));
  const v: PlatformCfg = { plans, discounts: { "1": pct("1"), "3": pct("3"), "6": pct("6"), "12": pct("12") }, bank: { bank: str(fd, "bank"), account: str(fd, "account"), name: str(fd, "accName") } };
  await rootDb.platformConfig.upsert({ where: { key: "main" }, update: { value: v }, create: { key: "main", value: v } });
  revalidatePath("/platform", "layout"); revalidatePath("/goi-dich-vu");
});
