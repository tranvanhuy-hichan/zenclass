"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str } from "@/lib/action";

export const addNote = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  if (!str(fd, "content")) throw new Error("Nhập nội dung");
  await db.note.create({ data: { content: str(fd, "content") } });
  revalidatePath("/");
});
export const toggleNote = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const n = await db.note.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  await db.note.update({ where: { id: n.id }, data: { done: !n.done } });
  revalidatePath("/");
});
export const deleteNote = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  await db.note.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/");
});
