// Dữ liệu demo: node: npx tsx prisma/seed-demo.ts  (XOÁ dữ liệu hiện có, trừ tài khoản admin)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { seedStaff } from "./staff-demo";

const db = new PrismaClient();
let seed = 20261029;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const chance = (p: number) => rnd() < p;
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const D = (s: string) => new Date(s + "T00:00:00.000Z");
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const TODAY = D("2026-10-29");

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Cao", "Đinh", "Lâm", "Trịnh"];
const DEM_M = ["Văn", "Minh", "Quang", "Đức", "Hữu", "Gia", "Anh", "Tuấn", "Thành", "Bảo"];
const DEM_F = ["Thị", "Ngọc", "Thu", "Phương", "Khánh", "Hồng", "Mai", "Diệu", "Thanh", "Bảo"];
const TEN_M = ["An", "Bình", "Cường", "Dũng", "Duy", "Hải", "Hiếu", "Hưng", "Khang", "Khoa", "Long", "Nam", "Phong", "Quân", "Sơn", "Thắng", "Tín", "Trung", "Việt", "Vinh", "Đạt", "Huy", "Kiên", "Lộc"];
const TEN_F = ["Anh", "Chi", "Dung", "Giang", "Hà", "Hạnh", "Hoa", "Lan", "Linh", "Mai", "My", "Ngân", "Nhi", "Oanh", "Phương", "Quỳnh", "Thảo", "Trang", "Trâm", "Uyên", "Vy", "Yến", "Ngọc", "Hân"];
const SCHOOLS = ["THCS Nguyễn Du", "THCS Lê Quý Đôn", "THPT Chu Văn An", "THCS Trần Phú", "THPT Lê Hồng Phong", "TH Kim Đồng", "THCS Đoàn Thị Điểm", "THPT Nguyễn Huệ"];
const SOURCES = ["Facebook", "Bạn bè giới thiệu", "Zalo", "Tờ rơi", "Google", "Phụ huynh cũ"];
const STREETS = ["Lê Lợi", "Trần Hưng Đạo", "Nguyễn Trãi", "Hai Bà Trưng", "Phan Chu Trinh", "Điện Biên Phủ", "Lý Thường Kiệt"];

function name(gender: "MALE" | "FEMALE", ho?: string) {
  const g = gender === "MALE";
  return `${ho ?? pick(HO)} ${pick(g ? DEM_M : DEM_F)} ${pick(g ? TEN_M : TEN_F)}`;
}
const noAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d");
const initials = (n: string) => noAccent(n).split(/\s+/).slice(-3).map((w) => w[0].toUpperCase()).join("");
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
async function many<T>(fn: (d: T[]) => Promise<unknown>, rows: T[], n = 1500) { for (const c of chunk(rows, n)) await fn(c); }

async function main() {
  if (process.env.CONFIRM_WIPE !== "yes") {
    console.error("Script này XOÁ toàn bộ dữ liệu (trừ tài khoản admin) rồi tạo dữ liệu demo.\nChạy lại với: CONFIRM_WIPE=yes npx tsx prisma/seed-demo.ts");
    process.exit(1);
  }
  console.log("Xoá dữ liệu cũ...");
  await db.$transaction([
    db.notification.deleteMany(), db.pushSub.deleteMany(), db.gradeValue.deleteMany(), db.attendance.deleteMany(), db.payment.deleteMany(), db.invoiceItem.deleteMany(), db.invoice.deleteMany(),
    db.enrollment.deleteMany(), db.session.deleteMany(), db.classSchedule.deleteMany(), db.class.deleteMany(), db.gradeColumn.deleteMany(), db.gradeTemplate.deleteMany(),
    db.remark.deleteMany(), db.material.deleteMany(), db.note.deleteMany(), db.expense.deleteMany(), db.payroll.deleteMany(), db.assistant.deleteMany(), db.coordinator.deleteMany(), db.holiday.deleteMany(), db.auditLog.deleteMany(),
    db.student.deleteMany(), db.parent.deleteMany(), db.teacher.deleteMany(), db.room.deleteMany(), db.user.deleteMany({ where: { username: { not: "admin" } } }),
  ]);

  const PW = await bcrypt.hash("123456", 8);
  const mkUser = (username: string, fullName: string, role: "STAFF" | "TEACHER" | "STUDENT" | "PARENT") =>
    ({ id: randomUUID(), username, fullName, role, passwordHash: PW, mustChangePwd: false } as const);

  // ---- Cài đặt
  await db.setting.upsert({
    where: { key: "center" }, update: {},
    create: { key: "center", value: { name: "Trung tâm Ngoại ngữ & Kỹ năng Sao Mai", bank: { bank: "SHB", account: "0967237399", name: "NGUYEN BA HUNG" }, maxEditDays: 7 } },
  });
  await db.holiday.createMany({ data: [{ date: D("2026-09-02"), name: "Quốc khánh" }, { date: D("2026-10-20"), name: "Ngày Phụ nữ Việt Nam" }, { date: D("2026-11-20"), name: "Ngày Nhà giáo VN" }, { date: D("2027-01-01"), name: "Tết Dương lịch" }] });
  const holidays = new Set((await db.holiday.findMany()).map((h) => h.date.getTime()));

  // ---- Nhân viên
  const staff = [mkUser("nv1", "Trần Thị Lan (Lễ tân)", "STAFF"), mkUser("nv2", "Lê Minh Tâm (Kế toán)", "STAFF"), mkUser("nv3", "Phạm Quốc Bảo (Tư vấn)", "STAFF")];
  await db.user.createMany({ data: staff });

  // ---- Giáo viên
  const tNames = ["Bùi Mai My", "Dương Minh Trang", "Bùi Hữu Long", "Hồ Tường Anh", "Phạm Khánh Duyên", "Bùi Thanh Duyên", "Bùi Gia Duy", "Nguyễn Hoàng Nam", "Lê Thu Hà", "Trần Quốc Việt", "Đặng Ngọc Lan", "Võ Thành Đạt"];
  const spec = ["IELTS", "IELTS", "Tiếng Anh giao tiếp", "IELTS Writing", "IELTS Speaking", "Tiếng Anh thiếu nhi", "Toán", "Toán tư duy", "Ngữ văn", "Lập trình", "Piano", "Tiếng Nhật"];
  const teacherUsers = tNames.map((n, i) => mkUser(`0903${String(100000 + i * 137).slice(0, 6)}`, n, "TEACHER"));
  await db.user.createMany({ data: teacherUsers });
  const teachers = tNames.map((n, i) => ({
    id: randomUUID(), userId: teacherUsers[i].id, fullName: n, phone: teacherUsers[i].username, gender: i % 3 === 0 ? "MALE" : "FEMALE",
    dob: D(`${1985 + (i % 10)}-0${1 + (i % 9)}-1${i % 9}`), email: `${noAccent(n).toLowerCase().replace(/\s+/g, ".")}@saomai.edu.vn`,
    address: `${int(1, 200)} ${pick(STREETS)}, Hà Nội`, idNumber: `0${int(10000000000, 99999999999)}`, degree: i < 5 ? `IELTS ${pick(["7.5", "8.0", "8.5"])}, Cử nhân Sư phạm Anh` : "Cử nhân Sư phạm",
    specialty: spec[i], bankName: pick(["Vietcombank", "SHB", "MB", "Techcombank"]), bankAccount: String(int(1000000000, 9999999999)), startDate: D(`202${int(2, 5)}-0${int(1, 9)}-01`),
    payType: i % 4 === 3 ? "FIXED" : i % 4 === 2 ? "PER_HOUR" : "PER_SESSION", payRate: i % 4 === 3 ? 8000000 : i % 4 === 2 ? 180000 : pick([200000, 250000, 300000]),
  }));
  await db.teacher.createMany({ data: teachers });

  // ---- Phòng
  const rooms = ["P101", "P102", "P103", "P104", "P201", "P202", "P203", "Phòng Lab"].map((n) => ({ id: randomUUID(), name: n, capacity: n === "Phòng Lab" ? 30 : 16 + int(0, 8) }));
  await db.room.createMany({ data: rooms });

  // ---- Bộ điểm
  const tplStd = randomUUID(), tplIelts = randomUUID(), tplMath = randomUUID();
  const ranks = [{ min: 9, label: "Xuất sắc" }, { min: 8, label: "Giỏi" }, { min: 6.5, label: "Khá" }, { min: 5, label: "Trung bình" }, { min: 0, label: "Yếu" }];
  await db.gradeTemplate.createMany({
    data: [
      { id: tplStd, name: "Chuẩn 3 cột (CC - GK - CK)", description: "Chuyên cần, giữa kỳ, cuối kỳ", formula: "", ranks },
      { id: tplIelts, name: "IELTS 4 kỹ năng", description: "Làm tròn 0.5 như thang band", formula: "round(avg(listening, reading, writing, speaking) * 2, 0) / 2", ranks: [{ min: 7, label: "Band 7+" }, { min: 6, label: "Band 6+" }, { min: 5, label: "Band 5+" }, { min: 0, label: "Dưới 5" }] },
      { id: tplMath, name: "THCS: KT15' - KT45' - GK - CK", description: "Hệ số 1-2-2-3", formula: "(kt15 + kt45 * 2 + gk * 2 + ck * 3) / 8", ranks },
    ],
  });
  const colDefs: [string, string, string, number][] = [
    [tplStd, "Chuyên cần", "cc", 1], [tplStd, "Giữa kỳ", "gk", 2], [tplStd, "Cuối kỳ", "ck", 3],
    [tplIelts, "Listening", "listening", 1], [tplIelts, "Reading", "reading", 1], [tplIelts, "Writing", "writing", 1], [tplIelts, "Speaking", "speaking", 1],
    [tplMath, "KT 15 phút", "kt15", 1], [tplMath, "KT 45 phút", "kt45", 2], [tplMath, "Giữa kỳ", "gk", 2], [tplMath, "Cuối kỳ", "ck", 3],
  ];
  const cols = colDefs.map(([templateId, name, key, weight], i) => ({ id: randomUUID(), templateId, name, key, weight, maxScore: 10, order: i }));
  await db.gradeColumn.createMany({ data: cols });

  // ---- Lớp học
  type CDef = { n: string; days: number[]; s: string; e: string; start: string; total: number; fee: number; tpl: string; max: number; billing?: string; finished?: boolean; spec: string };
  const defs: CDef[] = [
    { n: "IELTS A1", days: [1, 3], s: "17:00", e: "18:30", start: "2026-08-03", total: 36, fee: 4200000, tpl: tplIelts, max: 12, spec: "IELTS" },
    { n: "IELTS A2", days: [1, 3], s: "18:00", e: "19:30", start: "2026-08-10", total: 36, fee: 4500000, tpl: tplIelts, max: 12, spec: "IELTS" },
    { n: "IELTS B1", days: [1, 3], s: "19:00", e: "20:30", start: "2026-09-07", total: 36, fee: 4800000, tpl: tplIelts, max: 12, spec: "IELTS" },
    { n: "IELTS B2", days: [2, 4], s: "19:00", e: "20:30", start: "2026-07-14", total: 40, fee: 5200000, tpl: tplIelts, max: 12, spec: "IELTS" },
    { n: "IELTS Speaking 1", days: [2, 4], s: "17:00", e: "18:30", start: "2026-09-15", total: 24, fee: 3000000, tpl: tplIelts, max: 10, spec: "IELTS Speaking" },
    { n: "IELTS Writing 1", days: [1, 3], s: "21:00", e: "22:00", start: "2026-09-21", total: 24, fee: 3200000, tpl: tplIelts, max: 10, spec: "IELTS Writing" },
    { n: "Tiếng Anh giao tiếp A1", days: [2, 4], s: "18:30", e: "20:00", start: "2026-08-18", total: 30, fee: 2400000, tpl: tplStd, max: 14, spec: "Tiếng Anh giao tiếp" },
    { n: "Tiếng Anh giao tiếp A2", days: [2, 4], s: "20:00", e: "21:30", start: "2026-09-01", total: 30, fee: 2600000, tpl: tplStd, max: 14, spec: "Tiếng Anh giao tiếp" },
    { n: "Tiếng Anh thiếu nhi 1", days: [6, 0], s: "08:30", e: "10:00", start: "2026-08-29", total: 36, fee: 1000000, tpl: tplStd, max: 14, billing: "MONTHLY", spec: "Tiếng Anh thiếu nhi" },
    { n: "Tiếng Anh thiếu nhi 2", days: [6, 0], s: "10:15", e: "11:45", start: "2026-08-29", total: 36, fee: 1000000, tpl: tplStd, max: 14, billing: "MONTHLY", spec: "Tiếng Anh thiếu nhi" },
    { n: "Toán tư duy 1", days: [2, 4], s: "17:00", e: "18:30", start: "2026-09-08", total: 30, fee: 2200000, tpl: tplStd, max: 16, spec: "Toán tư duy" },
    { n: "Toán tư duy 2", days: [2, 5], s: "19:00", e: "20:30", start: "2026-09-08", total: 30, fee: 2200000, tpl: tplStd, max: 16, spec: "Toán tư duy" },
    { n: "Toán lớp 7", days: [1, 3], s: "17:00", e: "18:30", start: "2026-08-24", total: 40, fee: 3000000, tpl: tplMath, max: 18, spec: "Toán" },
    { n: "Toán lớp 8", days: [1, 3], s: "18:30", e: "20:00", start: "2026-08-24", total: 40, fee: 3000000, tpl: tplMath, max: 18, spec: "Toán" },
    { n: "Ngữ văn lớp 7", days: [5], s: "17:00", e: "18:30", start: "2026-08-28", total: 30, fee: 1800000, tpl: tplMath, max: 18, spec: "Ngữ văn" },
    { n: "Ngữ văn lớp 8", days: [5], s: "18:30", e: "20:00", start: "2026-08-28", total: 30, fee: 1800000, tpl: tplMath, max: 18, spec: "Ngữ văn" },
    { n: "Lập trình Python", days: [6], s: "14:00", e: "16:00", start: "2026-09-05", total: 20, fee: 2800000, tpl: tplStd, max: 12, spec: "Lập trình" },
    { n: "Piano cơ bản", days: [5], s: "20:00", e: "21:00", start: "2026-09-04", total: 24, fee: 3600000, tpl: tplStd, max: 6, spec: "Piano" },
    { n: "Tiếng Nhật cơ bản", days: [6], s: "09:00", e: "11:00", start: "2026-09-12", total: 24, fee: 3000000, tpl: tplStd, max: 14, spec: "Tiếng Nhật" },
    { n: "Hóa học cơ bản", days: [5, 0], s: "20:00", e: "21:00", start: "2026-04-03", total: 30, fee: 2400000, tpl: tplMath, max: 14, finished: true, spec: "Toán" },
  ];
  defs.forEach((d) => { d.max = Math.round(d.max * 1.9); });
  const tBusy = new Set<string>(), rBusy = new Set<string>();
  const classes: { id: string; def: CDef; teacherId: string; roomId: string; sessions: { id: string; date: Date; status: string; s: string; e: string }[] }[] = [];
  const classRows: object[] = [], schedRows: object[] = [], sessRows: object[] = [];
  for (const d of defs) {
    const cands = teachers.filter((t) => t.specialty === d.spec);
    const pool = cands.length ? cands : teachers;
    const slots = (id: string, pre: string) => d.days.map((w) => `${pre}${id}|${w}|${d.s}`);
    const t = pool.find((x) => !slots(x.id, "t").some((k) => tBusy.has(k))) ?? pick(pool);
    const r = rooms.find((x) => !slots(x.id, "r").some((k) => rBusy.has(k))) ?? pick(rooms);
    slots(t.id, "t").forEach((k) => tBusy.add(k)); slots(r.id, "r").forEach((k) => rBusy.add(k));
    const id = randomUUID();
    const sess: { id: string; date: Date; status: string; s: string; e: string }[] = [];
    let dt = D(d.start);
    while (sess.length < d.total) { if (!holidays.has(dt.getTime()) && d.days.includes(dt.getUTCDay())) sess.push({ id: randomUUID(), date: dt, status: dt < TODAY ? "DONE" : "PLANNED", s: d.s, e: d.e }); dt = addDays(dt, 1); }
    // vài buổi nghỉ
    if (!d.finished && chance(0.4)) { const c = sess.find((x) => x.status === "DONE" && sess.indexOf(x) > 2); if (c) c.status = "CANCELLED"; }
    classes.push({ id, def: d, teacherId: t.id, roomId: r.id, sessions: sess });
    classRows.push({ id, name: d.n, mode: "OFFLINE", teacherId: t.id, roomId: r.id, startDate: D(d.start), endDate: sess[sess.length - 1].date, totalSessions: d.total, maxStudents: d.max, tuitionFee: d.fee, billing: d.billing ?? "ONCE", finished: !!d.finished, gradeTemplateId: d.tpl });
    d.days.forEach((w) => schedRows.push({ id: randomUUID(), classId: id, weekday: w, startTime: d.s, endTime: d.e }));
    sess.forEach((x) => sessRows.push({ id: x.id, classId: id, date: x.date, startTime: x.s, endTime: x.e, teacherId: t.id, roomId: r.id, status: x.status, note: x.status === "CANCELLED" ? "Lớp nghỉ" : null }));
  }
  await db.class.createMany({ data: classRows as never });
  await db.classSchedule.createMany({ data: schedRows as never });
  await many((d) => db.session.createMany({ data: d as never }), sessRows);

  // ---- Phụ huynh & học viên
  const N = 320;
  const parents: object[] = [], parentUsers: ReturnType<typeof mkUser>[] = [], students: { id: string; code: string; dropped: boolean; parentId: string; name: string; level: number }[] = [];
  const studentRows: object[] = [], studentUsers: ReturnType<typeof mkUser>[] = [];
  const codes = new Set<string>();
  let pi = 0;
  while (students.length < N) {
    const ho = pick(HO);
    const pg = chance(0.5) ? "MALE" : "FEMALE";
    const pname = name(pg, ho);
    const phone = `09${String(10000000 + pi * 7919).slice(0, 8)}`; pi++;
    const pu = mkUser(phone, pname, "PARENT"); parentUsers.push(pu);
    const pid = randomUUID();
    parents.push({ id: pid, userId: pu.id, fullName: pname, phone, email: chance(0.5) ? `${noAccent(pname).toLowerCase().replace(/\s+/g, "")}@gmail.com` : null, address: `${int(1, 300)} ${pick(STREETS)}, Hà Nội`, job: pick(["Kinh doanh", "Giáo viên", "Kỹ sư", "Nhân viên văn phòng", "Bác sĩ", "Công chức"]), relation: pg === "MALE" ? "Bố" : "Mẹ" });
    for (let k = 0, kids = chance(0.25) ? 2 : 1; k < kids && students.length < N; k++) {
      const g = chance(0.5) ? "MALE" : "FEMALE";
      const nm = name(g, ho);
      let code = initials(nm) + int(100, 999);
      while (codes.has(code)) code = initials(nm) + int(100, 999);
      codes.add(code);
      const level = int(1, 12);
      const su = mkUser(code, nm, "STUDENT"); studentUsers.push(su);
      const id = randomUUID();
      const dropped = chance(0.04);
      students.push({ id, code, dropped, parentId: pid, name: nm, level });
      studentRows.push({ id, code, userId: su.id, fullName: nm, gender: g, dob: D(`${2026 - (5 + level)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`), phone: level > 8 ? `03${int(10000000, 99999999)}` : null, email: level > 9 ? `${code.toLowerCase()}@gmail.com` : null, address: `${int(1, 300)} ${pick(STREETS)}, Hà Nội`, school: pick(SCHOOLS), gradeLevel: `Lớp ${level}`, source: pick(SOURCES), emergencyContact: `${pname} - ${phone}`, note: chance(0.15) ? pick(["Hay quên bài tập", "Cần chú ý phát âm", "Học nhanh, cần bài nâng cao", "Dị ứng phấn"]) : null, dropped, discountPct: chance(0.08) ? pick([10, 20, 50]) : 0, discountNote: null, parentId: pid });
    }
  }
  await db.user.createMany({ data: [...parentUsers, ...studentUsers] });
  await db.parent.createMany({ data: parents as never });
  await db.student.createMany({ data: studentRows as never });

  // ---- Ghi danh
  const byClass = new Map<string, string[]>();
  const enr: { id: string; studentId: string; classId: string; total: number; status: string; used: number; sidx: number }[] = [];
  const stuSlots = new Map<string, Set<string>>();
  const eligible = (lvl: number, n: string) => (n.startsWith("IELTS") ? lvl >= 8 : n.includes("thiếu nhi") ? lvl <= 4 : n.includes("Toán tư duy") ? lvl <= 5 : n === "Toán lớp 7" || n === "Ngữ văn lớp 7" ? lvl === 7 : n === "Toán lớp 8" || n === "Ngữ văn lớp 8" ? lvl === 8 : n === "Hóa học cơ bản" ? lvl >= 8 : true);
  const active = students.filter((s) => !s.dropped);
  const waiting = new Set(active.filter(() => chance(0.06)).map((s) => s.id));
  for (const c of classes) {
    const ids = active.filter((s) => !waiting.has(s.id) && eligible(s.level, c.def.n) && !(stuSlots.get(s.id) ?? new Set()).has(`${c.def.days.join()}|${c.def.s}`)).sort(() => rnd() - 0.5).slice(0, Math.max(4, Math.min(c.def.max, int(c.def.max - 5, c.def.max)))).map((s) => s.id);
    for (const sid of ids) { const set = stuSlots.get(sid) ?? new Set<string>(); set.add(`${c.def.days.join()}|${c.def.s}`); stuSlots.set(sid, set); }
    byClass.set(c.id, ids);
    ids.forEach((sid, i) => enr.push({ id: randomUUID(), studentId: sid, classId: c.id, total: c.def.total, status: "ACTIVE", used: 0, sidx: i }));
  }
  // học viên đã nghỉ học vẫn có lịch sử ở lớp đã kết thúc
  const ended = classes.find((c) => c.def.finished)!;
  for (const s of students.filter((x) => x.dropped).slice(0, 8)) enr.push({ id: randomUUID(), studentId: s.id, classId: ended.id, total: ended.def.total, status: "DROPPED", used: 5, sidx: 0 });

  // ---- Điểm danh (các buổi đã diễn ra)
  const attRows: object[] = [], gvRows: object[] = [];
  const enrByKey = new Map(enr.map((e) => [`${e.studentId}|${e.classId}`, e]));
  const pendingExcused: string[] = [];
  for (const c of classes) {
    const sess = c.sessions.filter((s) => s.status === "DONE");
    for (const sid of byClass.get(c.id) ?? []) {
      const e = enrByKey.get(`${sid}|${c.id}`)!;
      const attendRate = pick([0.98, 0.92, 0.85, 0.75]);
      sess.forEach((s) => {
        let st = "PRESENT";
        const r = rnd();
        if (r > attendRate) st = chance(0.6) ? "ABSENT_EXCUSED" : "ABSENT"; else if (chance(0.05)) st = "LATE";
        const aid = randomUUID();
        attRows.push({ id: aid, sessionId: s.id, studentId: sid, status: st, markedBy: "seed", makeupDone: false });
        if (st !== "ABSENT_EXCUSED") e.used++;
        else if (chance(0.5)) pendingExcused.push(aid);
      });
    }
    // điểm
    const tpl = cols.filter((x) => x.templateId === c.def.tpl);
    for (const sid of byClass.get(c.id) ?? []) {
      const base = 5 + rnd() * 4.5;
      for (const col of tpl) if (chance(0.88)) gvRows.push({ id: randomUUID(), classId: c.id, studentId: sid, columnId: col.id, value: Math.min(10, Math.max(2, Math.round((base + (rnd() - 0.5) * 2.5) * 2) / 2)) });
    }
  }
  // một số buổi nghỉ có phép đã được xếp bù
  const excusedAll = (attRows as { id: string; status: string }[]).filter((a) => a.status === "ABSENT_EXCUSED");
  const doneMakeup = new Set(excusedAll.filter(() => chance(0.55)).map((a) => a.id));
  for (const a of attRows as { id: string; status: string; makeupDone: boolean }[]) if (doneMakeup.has(a.id)) a.makeupDone = true;
  // buổi hôm nay: điểm danh một nửa
  await many((d) => db.attendance.createMany({ data: d as never }), attRows, 3000);
  await many((d) => db.gradeValue.createMany({ data: d as never }), gvRows, 3000);

  // học viên: trạng thái ghi danh
  for (const e of enr) {
    if (e.status === "DROPPED") continue;
    if (e.used >= e.total) e.status = "FINISHED";
    else if (chance(0.03)) e.status = "PAUSED";
  }
  const endedClass = classes.find((c) => c.def.finished)!;
  for (const e of enr.filter((x) => x.classId === endedClass.id && x.status === "ACTIVE")) e.status = "FINISHED";
  await db.enrollment.createMany({ data: enr.map((e) => ({ id: e.id, studentId: e.studentId, classId: e.classId, startDate: D("2026-08-01"), totalSessions: e.total, usedSessions: e.used, status: e.status })) as never });

  // ---- Hoá đơn & thanh toán
  let invN = 0;
  const invRows: object[] = [], itemRows: object[] = [], payRows: object[] = [];
  const stuMap = new Map(students.map((s) => [s.id, s]));
  const studentRowMap = new Map((studentRows as { id: string; discountPct: number }[]).map((s) => [s.id, s]));
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const addInvoice = (studentId: string, items: { description: string; amount: number }[], issue: Date, due: Date, period: string | null, paidFrac: number) => {
    const total = items.reduce((s, i) => s + i.amount, 0);
    if (total <= 0) return;
    const id = randomUUID(); invN++;
    const paid = Math.round((total * paidFrac) / 1000) * 1000;
    invRows.push({ id, code: `PT${String(invN).padStart(5, "0")}`, studentId, issueDate: issue, dueDate: due, total, paid, status: paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID", period, note: null });
    items.forEach((i) => itemRows.push({ id: randomUUID(), invoiceId: id, ...i }));
    if (paid > 0) payRows.push({ id: randomUUID(), invoiceId: id, amount: paid, method: pick(["CASH", "BANK", "QR"]), paidAt: addDays(issue, int(0, 6)), receivedBy: "seed" });
  };
  const monthly = new Map<string, { studentId: string; period: string; issue: string; items: { description: string; amount: number }[]; frac: number }>();
  for (const e of enr) {
    if (e.status === "DROPPED") continue;
    const c = classMap.get(e.classId)!;
    const disc = studentRowMap.get(e.studentId)?.discountPct ?? 0;
    const frac = pick([1, 1, 1, 1, 0.5, 0, 0]);
    if (c.def.billing === "MONTHLY") {
      for (const [period, issue] of [["2026-09", "2026-09-01"], ["2026-10", "2026-10-01"]] as const) {
        const items = [{ description: `Học phí ${c.def.n} - tháng ${period.slice(5)}/${period.slice(0, 4)}`, amount: c.def.fee }];
        if (disc) items.push({ description: `Học bổng ${disc}%`, amount: -Math.round((c.def.fee * disc) / 100) });
        const k = `${e.studentId}|${period}`;
        const cur = monthly.get(k);
        if (cur) cur.items.push(...items); else monthly.set(k, { studentId: e.studentId, period, issue, items, frac: period === "2026-09" ? pick([1, 1, 1, 0]) : frac });
      }
    } else {
      const items = [{ description: `Học phí ${c.def.n} - Khoá ${iso(D(c.def.start)).split("-").reverse().join("/")}`, amount: c.def.fee }];
      if (disc) items.push({ description: `Học bổng ${disc}%`, amount: -Math.round((c.def.fee * disc) / 100) });
      const issue = addDays(D(c.def.start), -int(0, 10));
      addInvoice(e.studentId, items, issue, addDays(issue, 14), null, frac);
    }
  }
  for (const m of monthly.values()) addInvoice(m.studentId, m.items, D(m.issue), addDays(D(m.issue), 7), m.period, m.frac);
  void stuMap;
  await many((d) => db.invoice.createMany({ data: d as never }), invRows);
  await many((d) => db.invoiceItem.createMany({ data: d as never }), itemRows);
  await many((d) => db.payment.createMany({ data: d as never }), payRows);

  // ---- Chi phí, lương, ghi chú, nhận xét, tài liệu, thông báo
  const exp: object[] = [];
  for (const [m, base] of [["2026-08", 1], ["2026-09", 1.05], ["2026-10", 1.1]] as const) {
    exp.push({ category: "Thuê mặt bằng", amount: 28000000, date: D(`${m}-05`), note: "Tiền thuê tháng" }, { category: "Điện nước", amount: Math.round(3200000 * base), date: D(`${m}-10`) }, { category: "Marketing", amount: Math.round(6500000 * base), date: D(`${m}-12`), note: "Quảng cáo Facebook" }, { category: "Thiết bị", amount: int(500000, 4000000), date: D(`${m}-18`), note: "Văn phòng phẩm, máy chiếu" });
  }
  await db.expense.createMany({ data: exp as never });
  const doneSess = classes.flatMap((c) => c.sessions.filter((s) => s.status === "DONE").map((s) => ({ ...s, teacherId: c.teacherId })));
  for (const t of teachers) {
    const mine = doneSess.filter((s) => s.teacherId === t.id && iso(s.date).startsWith("2026-09"));
    const hours = mine.reduce((h, s) => h + (parseInt(s.e) * 60 + parseInt(s.e.slice(3)) - parseInt(s.s) * 60 - parseInt(s.s.slice(3))) / 60, 0);
    const base = t.payType === "FIXED" ? t.payRate : t.payType === "PER_HOUR" ? Math.round(hours * t.payRate) : mine.length * t.payRate;
    if (mine.length) await db.payroll.create({ data: { teacherId: t.id, month: "2026-09", sessions: mine.length, hours, baseAmount: base, adjustment: chance(0.3) ? 300000 : 0, status: "PAID", paidAt: D("2026-10-05"), paidBy: "seed" } });
  }
  await db.note.createMany({ data: [{ content: "Gọi phụ huynh các em nợ học phí quá hạn" }, { content: "Chuẩn bị đề kiểm tra giữa kỳ lớp IELTS B1" }, { content: "Sửa máy chiếu phòng P102", done: true }, { content: "In phiếu tài khoản cho học viên mới" }] });
  const someStu = students.filter((s) => !s.dropped).slice(0, 60);
  await db.remark.createMany({ data: someStu.map((s) => ({ studentId: s.id, content: pick(["Em tiến bộ rõ rệt, tích cực phát biểu.", "Cần luyện thêm phần nghe, làm bài tập đầy đủ hơn.", "Hay đi muộn, mong phụ huynh nhắc nhở.", "Tiếp thu nhanh, nên cho làm bài nâng cao.", "Chăm chỉ, hoàn thành tốt bài tập về nhà."]), author: pick(tNames) })) });
  await db.material.createMany({ data: [{ title: "Giáo trình IELTS Foundation (PDF)", url: "https://drive.google.com/", classId: classes[0].id }, { title: "Bộ đề Toán lớp 7 - HK1", url: "https://drive.google.com/", classId: classes[12].id }, { title: "Nội quy trung tâm", url: "https://example.com/noi-quy" }, { title: "Video bài giảng Python buổi 1", url: "https://youtube.com/", classId: classes[16].id }] });
  const notiUsers = studentUsers.slice(0, 40);
  await db.notification.createMany({ data: notiUsers.flatMap((u) => [{ userId: u.id, type: "REMIND", title: "Sắp đến giờ học", body: "Lớp học của bạn bắt đầu sau 60 phút.", read: chance(0.6) }, { userId: u.id, type: "ANNOUNCE", title: "Thông báo nghỉ lễ", body: "Trung tâm nghỉ ngày 20/11 nhân ngày Nhà giáo Việt Nam.", read: chance(0.3) }]) });

  await seedStaff(db);
  console.log("XONG.");
  console.log({ giaoVien: teachers.length, phong: rooms.length, lop: classes.length, hocVien: students.length, phuHuynh: parents.length, ghiDanh: enr.length, diemDanh: attRows.length, diem: gvRows.length, hoaDon: invRows.length });
  console.log("Tài khoản demo (mật khẩu chung 123456): admin/admin123 · nv1 · giáo viên:", teacherUsers[0].username, "· học viên:", students[0].code, "· phụ huynh:", (parentUsers[0] as { username: string }).username);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
