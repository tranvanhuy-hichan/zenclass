import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const pw = process.env.ADMIN_PASSWORD ?? "admin123";
  await db.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", fullName: "Quản trị viên", role: "ADMIN", passwordHash: await bcrypt.hash(pw, 10) },
  });
  console.log("Admin: admin /", pw);
}
main().finally(() => db.$disconnect());
