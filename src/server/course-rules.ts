import { db } from "@/lib/db";

/** Học bù và chuyển lớp chỉ được thực hiện giữa các lớp trong CÙNG MỘT khoá học. */
export async function assertSameCourse(fromClassId: string, toClassId: string, what: "chuyển lớp" | "học bù") {
  const [a, b] = await Promise.all([
    db.class.findUniqueOrThrow({ where: { id: fromClassId }, include: { course: true } }),
    db.class.findUniqueOrThrow({ where: { id: toClassId }, include: { course: true } }),
  ]);
  if (!a.courseId) throw new Error(`Lớp "${a.name}" chưa thuộc khoá học nào nên không thể ${what}. Hãy gán khoá học cho lớp trước.`);
  if (a.courseId !== b.courseId)
    throw new Error(`Chỉ được ${what} trong cùng một khoá học. "${a.name}" thuộc khoá "${a.course?.name}", còn "${b.name}" thuộc khoá "${b.course?.name ?? "chưa có"}".`);
}
