"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str, int } from "@/lib/action";

export const createRoom = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const name = str(fd, "name");
  if (!name) throw new Error("Nhập tên phòng");
  const branchId = str(fd, "branchId");
  if (!branchId) throw new Error("Chọn cơ sở cho phòng");
  if (await db.room.findFirst({ where: { name, branchId } })) throw new Error("Cơ sở này đã có phòng cùng tên");
  await db.room.create({ data: { name, branchId, capacity: int(fd, "capacity", 20) } });
  revalidatePath("/phong-hoc");
});

export const deleteRoom = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  if (await db.class.count({ where: { roomId: id } })) throw new Error("Phòng đang được gán cho lớp");
  await db.session.updateMany({ where: { roomId: id }, data: { roomId: null } });
  await db.room.delete({ where: { id } });
  revalidatePath("/phong-hoc");
  redirect("/phong-hoc");
});

export const updateRoom = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) throw new Error("Nhập tên phòng");
  const branchId = str(fd, "branchId");
  if (!branchId) throw new Error("Chọn cơ sở cho phòng");
  if (await db.room.findFirst({ where: { name, branchId, id: { not: id } } })) throw new Error("Cơ sở này đã có phòng cùng tên");
  const capacity = int(fd, "capacity", 20);
  if (capacity < 1) throw new Error("Sức chứa phải lớn hơn 0");
  await db.room.update({ where: { id }, data: { name, capacity, branchId } });
  revalidatePath("/phong-hoc");
  revalidatePath(`/phong-hoc/${id}`);
});
