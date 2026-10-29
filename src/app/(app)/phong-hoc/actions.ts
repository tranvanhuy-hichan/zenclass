"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str, int } from "@/lib/action";

export const createRoom = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const name = str(fd, "name");
  if (!name) throw new Error("Nhập tên phòng");
  if (await db.room.findUnique({ where: { name } })) throw new Error("Phòng đã tồn tại");
  await db.room.create({ data: { name, capacity: int(fd, "capacity", 20) } });
  revalidatePath("/phong-hoc");
});

export const deleteRoom = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  if (await db.class.count({ where: { roomId: id } })) throw new Error("Phòng đang được gán cho lớp");
  await db.session.updateMany({ where: { roomId: id }, data: { roomId: null } });
  await db.room.delete({ where: { id } });
  revalidatePath("/phong-hoc");
});
