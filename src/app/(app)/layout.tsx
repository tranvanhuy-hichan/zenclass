import { redirect } from "next/navigation";
import { getMe } from "@/lib/guard";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Shell } from "@/components/layout/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");
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
