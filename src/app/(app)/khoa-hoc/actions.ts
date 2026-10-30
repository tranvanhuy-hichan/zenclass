"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str, int, opt } from "@/lib/action";

function read(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("Nhập tên khoá học");
  return { name, code: opt(fd, "code"), subject: opt(fd, "subject"), level: opt(fd, "level"), description: opt(fd, "description"), totalSessions: int(fd, "totalSessions", 24), tuitionFee: int(fd, "tuitionFee") };
}

export const createCourse = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const d = read(fd);
  if (await db.course.findFirst({ where: { name: d.name } })) throw new Error("Tên khoá học đã tồn tại");
  const c = await db.course.create({ data: d });
  revalidatePath("/khoa-hoc");
  redirect(`/khoa-hoc/${c.id}`);
});

export const updateCourse = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  const d = read(fd);
  if (await db.course.findFirst({ where: { name: d.name, id: { not: id } } })) throw new Error("Tên khoá học đã tồn tại");
  await db.course.update({ where: { id }, data: { ...d, active: fd.get("active") === "on" } });
  revalidatePath("/khoa-hoc"); revalidatePath(`/khoa-hoc/${id}`);
});

export const deleteCourse = wrap(async (fd) => {
  await assertRole("ADMIN");
  const id = str(fd, "id");
  if (await db.class.count({ where: { courseId: id } })) throw new Error("Khoá học còn lớp, hãy chuyển các lớp sang khoá khác trước");
  await db.course.delete({ where: { id } });
  revalidatePath("/khoa-hoc");
  redirect("/khoa-hoc");
});
