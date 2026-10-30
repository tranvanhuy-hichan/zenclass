import { redirect } from "next/navigation";
import Link from "next/link";
import { getMe } from "@/lib/guard";
import { db, rootDb } from "@/lib/db";
import { getTenant } from "@/lib/tenant-cache";
import { getSettings } from "@/lib/settings";
import { Shell } from "@/components/layout/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");

  // Quản trị nền tảng: không thuộc trung tâm nào, đọc bằng kết nối gốc.
  if (me.role === "SUPERADMIN") {
    const u = await rootDb.user.findUnique({ where: { id: me.id }, select: { mustChangePwd: true, isActive: true } });
    if (!u?.isActive) redirect("/login");
    return <Shell role={me.role} userName={me.name} name="Quản trị nền tảng" logo="/logo.png" unread={0} mustChange={!!u.mustChangePwd}>{children}</Shell>;
  }

  const tenant = me.tenantId ? await getTenant(me.tenantId) : null;
  if (!tenant) redirect("/login");
  const expired = !!tenant.expiresAt && tenant.expiresAt < new Date();
  const daysLeft = tenant.expiresAt && !expired ? Math.ceil((tenant.expiresAt.getTime() - Date.now()) / 86400_000) : null;
  // Tạm khoá: chặn hoàn toàn. Hết hạn: quản trị viên vẫn vào được nhưng chỉ ở trang gia hạn; người khác bị chặn.
  if (tenant.status !== "ACTIVE" || (expired && me.role !== "ADMIN")) {
    return (
      <main className="grid min-h-screen place-items-center p-4">
        <div className="max-w-md space-y-3 rounded-lg border bg-white p-6 text-center">
          <h1 className="text-lg font-semibold">{tenant.name}</h1>
          <p className="text-sm text-slate-600">{tenant.status !== "ACTIVE" ? "Tài khoản trung tâm đang bị tạm khoá. Vui lòng liên hệ đơn vị cung cấp." : "Gói dịch vụ của trung tâm đã hết hạn. Vui lòng liên hệ quản trị viên trung tâm để gia hạn."}</p>
          <Link href="/api/auth/signout" className="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-slate-50">Đăng xuất</Link>
        </div>
      </main>
    );
  }

  const [st, u] = await Promise.all([
    getSettings(),
    db.user.findUnique({ where: { id: me.id }, select: { mustChangePwd: true, isActive: true } }),
  ]);
  if (!u?.isActive) redirect("/login");
  return (
    <Shell role={me.role} userName={me.name} name={st.name} logo={st.theme.logo || "/logo.png"} unread={0} mustChange={!!u.mustChangePwd} renewOnly={expired}>
      {me.role === "ADMIN" && daysLeft != null && daysLeft <= 7 && (
        <Link href="/goi-dich-vu" className={`mb-4 block rounded-lg border px-4 py-2.5 text-sm ${daysLeft <= 3 ? "border-red-300 bg-red-50 text-red-700" : "border-yellow-300 bg-yellow-50 text-yellow-900"}`}>
          {daysLeft <= 3 ? "⚠ " : ""}Gói dịch vụ {daysLeft <= 0 ? "hết hạn hôm nay" : `chỉ còn ${daysLeft} ngày`} (đến {tenant.expiresAt!.toLocaleDateString("vi-VN")}). <b className="underline">Gia hạn ngay</b> để không bị gián đoạn.
        </Link>
      )}
      {children}
    </Shell>
  );
}
