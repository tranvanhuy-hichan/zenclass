import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { genPassword } from "@/lib/password";
import type { Role } from "@prisma/client";

export async function createUser(role: Role, username: string, fullName: string) {
  const password = genPassword();
  const user = await db.user.create({
    data: { username, fullName, role, passwordHash: await bcrypt.hash(password, 10), mustChangePwd: true },
  });
  return { user, password };
}

export async function resetPassword(userId: string) {
  const password = genPassword();
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10), mustChangePwd: true, failedLogins: 0, lockedUntil: null },
  });
  return password;
}
