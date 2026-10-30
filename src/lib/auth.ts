import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { rootDb as db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(c) {
        if (!c?.username || !c.password) return null;
        // Tên đăng nhập là duy nhất toàn hệ thống nên không cần mã trung tâm: tài khoản quyết định trung tâm.
        const u = await db.user.findUnique({ where: { username: c.username.trim() } });
        if (!u || !u.isActive) return null;
        const tenant = u.tenantId ? await db.tenant.findUnique({ where: { id: u.tenantId } }) : null;
        if (u.role !== "SUPERADMIN" && !tenant) return null;
        if (tenant && tenant.status !== "ACTIVE") throw new Error("TENANT_SUSPENDED"); // hết hạn vẫn cho vào để quản trị viên gia hạn
        if (u.lockedUntil && u.lockedUntil > new Date()) return null;
        const ok = await bcrypt.compare(c.password, u.passwordHash);
        if (!ok) {
          const fails = u.failedLogins + 1;
          await db.user.update({
            where: { id: u.id },
            data: { failedLogins: fails, lockedUntil: fails >= 5 ? new Date(Date.now() + 15 * 60_000) : null },
          });
          return null;
        }
        await db.user.update({ where: { id: u.id }, data: { failedLogins: 0, lockedUntil: null } });
        return { id: u.id, name: u.fullName, role: u.role, tenantId: u.tenantId } as never;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as unknown as { role: string }).role;
        token.tid = (user as unknown as { tenantId: string | null }).tenantId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      (session.user as { id?: string; role?: string }).id = token.uid as string;
      (session.user as { id?: string; role?: string }).role = token.role as string;
      (session.user as { tenantId?: string | null }).tenantId = (token.tid as string | null) ?? null;
      return session;
    },
  },
};
