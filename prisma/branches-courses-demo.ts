// Thêm dữ liệu demo Cơ sở + Khoá học và gán cho phòng/lớp hiện có (không xoá dữ liệu khác).
import { PrismaClient } from "@prisma/client";

export async function seedBranchesCourses(db: PrismaClient) {
  if ((await db.branch.count()) > 0 || (await db.course.count()) > 0) return { skipped: true };
  const b1 = await db.branch.create({ data: { name: "Cơ sở Cầu Giấy", address: "120 Trần Thái Tông, Cầu Giấy, Hà Nội", phone: "0967 237 399" } });
  const b2 = await db.branch.create({ data: { name: "Cơ sở Thanh Xuân", address: "45 Nguyễn Trãi, Thanh Xuân, Hà Nội", phone: "0967 237 398" } });
  const rooms = await db.room.findMany();
  for (const r of rooms) await db.room.update({ where: { id: r.id }, data: { branchId: /^P1|^P0/.test(r.name) ? b1.id : b2.id } });

  const groups: [string, string, string, string[]][] = [
    ["IELTS Foundation", "IELTS-F", "IELTS", ["IELTS A1", "IELTS A2"]],
    ["IELTS Intermediate", "IELTS-I", "IELTS", ["IELTS B1", "IELTS B2"]],
    ["IELTS Speaking", "IELTS-SP", "IELTS", ["IELTS Speaking 1"]],
    ["IELTS Writing", "IELTS-WR", "IELTS", ["IELTS Writing 1"]],
    ["Tiếng Anh giao tiếp", "TAGT", "Tiếng Anh", ["Tiếng Anh giao tiếp A1", "Tiếng Anh giao tiếp A2"]],
    ["Tiếng Anh thiếu nhi", "TANN", "Tiếng Anh", ["Tiếng Anh thiếu nhi 1", "Tiếng Anh thiếu nhi 2"]],
    ["Toán tư duy", "TTD", "Toán", ["Toán tư duy 1", "Toán tư duy 2"]],
    ["Toán THCS", "TOAN-THCS", "Toán", ["Toán lớp 7", "Toán lớp 8"]],
    ["Ngữ văn THCS", "VAN-THCS", "Ngữ văn", ["Ngữ văn lớp 7", "Ngữ văn lớp 8"]],
    ["Lập trình Python", "PY", "Tin học", ["Lập trình Python"]],
    ["Piano cơ bản", "PIANO", "Âm nhạc", ["Piano cơ bản"]],
    ["Tiếng Nhật cơ bản", "JP-N5", "Tiếng Nhật", ["Tiếng Nhật cơ bản"]],
    ["Hóa học cơ bản", "HOA", "Hóa học", ["Hóa học cơ bản"]],
  ];
  let n = 0;
  for (const [name, code, subject, classNames] of groups) {
    const cls = await db.class.findMany({ where: { name: { in: classNames } } });
    const first = cls[0];
    const course = await db.course.create({ data: { name, code, subject, totalSessions: first?.totalSessions ?? 24, tuitionFee: first?.tuitionFee ?? 0, description: `Chương trình ${name}` } });
    for (const c of cls) { await db.class.update({ where: { id: c.id }, data: { courseId: course.id } }); n++; }
  }
  await balanceRooms(db);
  return { branches: 2, courses: groups.length, classes: n };
}

/** Chia lớp đều cho 2 cơ sở và xếp phòng sao cho không trùng giờ trong cùng một phòng. */
export async function balanceRooms(db: PrismaClient) {
  const TX = ["IELTS B1", "IELTS B2", "IELTS Speaking 1", "IELTS Writing 1", "Tiếng Anh thiếu nhi 1", "Tiếng Anh thiếu nhi 2", "Lập trình Python", "Toán tư duy 1", "Toán tư duy 2", "Piano cơ bản"];
  const rooms = await db.room.findMany({ include: { branch: true }, orderBy: { name: "asc" } });
  const classes = await db.class.findMany({ where: { finished: false }, include: { schedules: true }, orderBy: { name: "asc" } });
  const busy = new Map<string, [number, number, number][]>();
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  let moved = 0;
  for (const c of classes) {
    const tx = TX.includes(c.name);
    const pool = rooms.filter((r) => (r.branch?.name.includes("Thanh Xuân") ? tx : !tx) && r.capacity >= Math.min(c.maxStudents, 16));
    const room = pool.find((r) => c.schedules.every((sc) => !(busy.get(r.id) ?? []).some(([d, a, b]) => d === sc.weekday && m(sc.startTime) < b && a < m(sc.endTime)))) ?? pool[0];
    if (!room) continue;
    for (const sc of c.schedules) busy.set(room.id, [...(busy.get(room.id) ?? []), [sc.weekday, m(sc.startTime), m(sc.endTime)]]);
    await db.class.update({ where: { id: c.id }, data: { roomId: room.id } });
    await db.session.updateMany({ where: { classId: c.id, status: "PLANNED" }, data: { roomId: room.id } });
    moved++;
  }
  return moved;
}

if (process.argv[1]?.endsWith("branches-courses-demo.ts")) {
  const db = new PrismaClient();
  (process.argv[2] === "balance" ? balanceRooms(db) : seedBranchesCourses(db)).then((r) => console.log(r)).finally(() => db.$disconnect());
}
