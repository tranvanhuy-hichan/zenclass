import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(c) {
        if (!c?.username || !c.password) return null;
        const u = await db.user.findUnique({ where: { username: c.username.trim() } });
        if (!u || !u.isActive) return null;
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
        return { id: u.id, name: u.fullName, role: u.role } as never;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as unknown as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      (session.user as { id?: string; role?: string }).id = token.uid as string;
      (session.user as { id?: string; role?: string }).role = token.role as string;
      return session;
    },
  },
};
