import { redirect } from "next/navigation";
import Link from "next/link";
import { getMe } from "@/lib/guard";
import { db, rootDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Shell } from "@/components/layout/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");

  // Quản trị nền tảng: không thuộc trung tâm nào, đọc bằng kết nối gốc.
  if (me.role === "SUPERADMIN") {
    const u = await rootDb.user.findUnique({ where: { id: me.id }, select: { mustChangePwd: true, isActive: true } });
    if (!u?.isActive) redirect("/login");
    return <Shell role={me.role} userName={me.name} name="Quản trị nền tảng" logo="" unread={0} mustChange={!!u.mustChangePwd}>{children}</Shell>;
  }

  const tenant = me.tenantId ? await rootDb.tenant.findUnique({ where: { id: me.tenantId } }) : null;
  if (!tenant) redirect("/login");
  if (tenant.status !== "ACTIVE" || (tenant.expiresAt && tenant.expiresAt < new Date())) {
    return (
      <main className="grid min-h-screen place-items-center p-4">
        <div className="max-w-md space-y-3 rounded-lg border bg-white p-6 text-center">
          <h1 className="text-lg font-semibold">{tenant.name}</h1>
          <p className="text-sm text-slate-600">{tenant.status !== "ACTIVE" ? "Tài khoản trung tâm đang bị tạm khoá." : "Gói dịch vụ của trung tâm đã hết hạn."} Vui lòng liên hệ đơn vị cung cấp để gia hạn.</p>
          <Link href="/api/auth/signout" className="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-slate-50">Đăng xuất</Link>
        </div>
      </main>
    );
  }

  const [st, unread, u] = await Promise.all([
    getSettings(),
    db.notification.count({ where: { userId: me.id, read: false } }),
    db.user.findUnique({ where: { id: me.id }, select: { mustChangePwd: true, isActive: true } }),
  ]);
  if (!u?.isActive) redirect("/login");
  return (
    <Shell role={me.role} userName={me.name} name={st.name} logo={st.theme.logo} unread={unread} mustChange={!!u.mustChangePwd}>
      {children}
    </Shell>
  );
}
