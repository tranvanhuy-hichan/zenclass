import { slugClient, slugTenantId } from "../src/lib/db";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = (slugClient() as unknown as PrismaClient);

async function main() {
  const pw = process.env.ADMIN_PASSWORD ?? "admin123";
  if (!(await db.user.findFirst({ where: { username: "admin" } })))
    await db.user.create({
    data: { username: "admin", fullName: "Quản trị viên", role: "ADMIN", passwordHash: await bcrypt.hash(pw, 10) },
  });
  console.log("Admin: admin /", pw);
}
main().finally(() => db.$disconnect());
