"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str, opt } from "@/lib/action";
import { assertQuota } from "@/server/quota";

export const createBranch = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  await assertQuota("branches");
  const name = str(fd, "name");
  if (!name) throw new Error("Nhập tên cơ sở");
  if (await db.branch.findFirst({ where: { name } })) throw new Error("Tên cơ sở đã tồn tại");
  await db.branch.create({ data: { name, address: opt(fd, "address"), phone: opt(fd, "phone"), note: opt(fd, "note") } });
  revalidatePath("/co-so");
});

export const updateBranch = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const id = str(fd, "id"), name = str(fd, "name");
  if (!name) throw new Error("Nhập tên cơ sở");
  if (await db.branch.findFirst({ where: { name, id: { not: id } } })) throw new Error("Tên cơ sở đã tồn tại");
  await db.branch.update({ where: { id }, data: { name, address: opt(fd, "address"), phone: opt(fd, "phone"), note: opt(fd, "note"), active: fd.get("active") === "on" } });
  revalidatePath("/co-so"); revalidatePath(`/co-so/${id}`);
});

export const deleteBranch = wrap(async (fd) => {
  await assertRole("ADMIN");
  const id = str(fd, "id");
  if (await db.room.count({ where: { branchId: id } })) throw new Error("Cơ sở còn phòng học, hãy chuyển hoặc xoá các phòng trước");
  await db.branch.delete({ where: { id } });
  revalidatePath("/co-so");
  redirect("/co-so");
});
