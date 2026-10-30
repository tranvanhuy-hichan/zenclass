// Tạo / đặt lại tài khoản quản trị nền tảng (không thuộc trung tâm nào).
//   SUPERADMIN_PASSWORD='...' npx tsx prisma/saas/create-superadmin.ts [tên đăng nhập, mặc định: superadmin]
import bcrypt from "bcryptjs";
import { rootDb } from "../../src/lib/db";

(async () => {
  const username = process.argv[2] ?? "superadmin";
  const pw = process.env.SUPERADMIN_PASSWORD;
  if (!pw || pw.length < 8) throw new Error("Đặt biến môi trường SUPERADMIN_PASSWORD (tối thiểu 8 ký tự)");
  const passwordHash = await bcrypt.hash(pw, 10);
  const old = await rootDb.user.findUnique({ where: { username } });
  if (old && old.role !== "SUPERADMIN") throw new Error(`Tên "${username}" đang là tài khoản của một trung tâm`);
  if (old) await rootDb.user.update({ where: { id: old.id }, data: { passwordHash, isActive: true, mustChangePwd: false, failedLogins: 0, lockedUntil: null } });
  else await rootDb.user.create({ data: { username, fullName: "Quản trị nền tảng", role: "SUPERADMIN", tenantId: null, passwordHash, mustChangePwd: false } });
  console.log(`OK: ${old ? "đã cập nhật" : "đã tạo"} tài khoản ${username}`);
  await rootDb.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
