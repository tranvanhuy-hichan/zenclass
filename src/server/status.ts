import { db } from "@/lib/db";

export type StudentStatus = "learning" | "waiting" | "makeup" | "ending" | "finished" | "dropped";

export const STATUS_LABEL: Record<StudentStatus, string> = {
  learning: "Đang học",
  waiting: "Chờ lớp",
  makeup: "Nghỉ chưa xếp bù",
  ending: "Sắp hết",
  finished: "Hết khóa",
  dropped: "Nghỉ học",
};
export const STATUS_COLOR: Record<StudentStatus, string> = {
  learning: "text-green-700",
  waiting: "text-sky-700",
  makeup: "text-red-600",
  ending: "text-yellow-700",
  finished: "text-red-700",
  dropped: "text-gray-500",
};

export type StudentRow = Awaited<ReturnType<typeof loadStudents>>[number];

export async function loadStudents(where: object = {}) {
  const list = await db.student.findMany({
    where,
    orderBy: { fullName: "asc" },
    include: {
      enrollments: { include: { class: true } },
      attendances: { where: { status: "ABSENT_EXCUSED", makeupDone: false }, select: { id: true } },
    },
  });
  return list.map((s) => {
    const active = s.enrollments.filter((e) => e.status === "ACTIVE");
    const remain = active.reduce((m, e) => Math.min(m, e.totalSessions - e.usedSessions), Infinity);
    let status: StudentStatus;
    if (s.dropped) status = "dropped";
    else if (active.length) status = s.attendances.length ? "makeup" : remain <= 3 ? "ending" : "learning";
    else if (s.enrollments.length && s.enrollments.every((e) => e.status === "FINISHED")) status = "finished";
    else status = "waiting";
    return { ...s, status, remain: remain === Infinity ? null : remain };
  });
}
