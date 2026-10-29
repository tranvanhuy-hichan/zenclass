// Thêm dữ liệu demo Trợ giảng + Giáo vụ và gán vào các lớp hiện có (không xoá dữ liệu khác).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export async function seedStaff(db: PrismaClient) {
  if ((await db.assistant.count()) > 0 || (await db.coordinator.count()) > 0) return { skipped: true };
  const PW = await bcrypt.hash("123456", 8);
  const mk = (username: string, fullName: string, role: "TEACHER" | "STAFF") => ({ id: randomUUID(), username, fullName, role, passwordHash: PW, mustChangePwd: false });

  const aNames = ["Nguyễn Thu Hằng", "Trần Minh Khôi", "Lê Bảo Ngọc", "Phạm Quốc Huy", "Hoàng Diệu Linh", "Vũ Đức Mạnh"];
  const aSpec = ["IELTS", "Tiếng Anh", "Toán", "Ngữ văn", "Tiếng Anh thiếu nhi", "Lập trình"];
  const aUsers = aNames.map((n, i) => mk(`0988${String(100100 + i * 211).slice(0, 6)}`, n, "TEACHER"));
  await db.user.createMany({ data: aUsers });
  const assistants = aNames.map((n, i) => ({
    id: randomUUID(), userId: aUsers[i].id, fullName: n, phone: aUsers[i].username, gender: i % 2 ? "MALE" : "FEMALE", email: `ta${i + 1}@saomai.edu.vn`,
    address: `${10 + i * 7} Lý Thường Kiệt, Hà Nội`, degree: "Sinh viên năm cuối ĐH Sư phạm", specialty: aSpec[i], payType: "PER_SESSION", payRate: 80000 + i * 10000,
    bankName: "MB", bankAccount: String(1000000000 + i * 1234567), startDate: new Date(`2025-0${1 + (i % 9)}-01T00:00:00Z`),
  }));
  await db.assistant.createMany({ data: assistants });

  const cNames = ["Trần Thị Lan", "Lê Minh Tâm", "Phạm Quỳnh Anh"];
  const cPos = ["Giáo vụ trưởng", "Giáo vụ", "Giáo vụ"];
  const cUsers = cNames.map((n, i) => mk(`0977${String(200200 + i * 313).slice(0, 6)}`, n, "STAFF"));
  await db.user.createMany({ data: cUsers });
  const coordinators = cNames.map((n, i) => ({
    id: randomUUID(), userId: cUsers[i].id, fullName: n, phone: cUsers[i].username, gender: "FEMALE", email: `gv${i + 1}@saomai.edu.vn`,
    address: `${20 + i * 5} Trần Hưng Đạo, Hà Nội`, position: cPos[i], salary: 9000000 + i * 500000, bankName: "Vietcombank", bankAccount: String(2000000000 + i * 7654321),
    startDate: new Date(`2024-0${2 + i}-01T00:00:00Z`),
  }));
  await db.coordinator.createMany({ data: coordinators });

  const classes = await db.class.findMany({ orderBy: { name: "asc" } });
  for (const [i, c] of classes.entries()) {
    await db.class.update({ where: { id: c.id }, data: { assistantId: assistants[i % assistants.length].id, coordinatorId: coordinators[i % coordinators.length].id } });
  }
  return { assistants: assistants.length, coordinators: coordinators.length, classes: classes.length };
}

if (process.argv[1]?.endsWith("staff-demo.ts")) {
  const db = new PrismaClient();
  seedStaff(db).then((r) => console.log(r)).finally(() => db.$disconnect());
}
