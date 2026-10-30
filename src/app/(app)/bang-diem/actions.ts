"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertRole, STAFF_ROLES } from "@/lib/guard";
import { wrap, str, opt } from "@/lib/action";
import { DEFAULT_RANKS, textToRanks, validateFormula } from "@/lib/grade";

const num = (fd: FormData, k: string, d: number) => {
  const v = parseFloat(str(fd, k).replace(",", "."));
  return Number.isFinite(v) ? v : d;
};
function makeKey(name: string, raw: string) {
  const base = (raw || name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const k = /^[a-z]/.test(base) ? base : "c" + base;
  if (k.length < 1 || k === "c") throw new Error("Mã cột không hợp lệ");
  return k.slice(0, 20);
}

const PRESETS: Record<string, { name: string; key: string; weight: number }[]> = {
  blank: [],
  standard: [{ name: "Chuyên cần", key: "cc", weight: 1 }, { name: "Giữa kỳ", key: "gk", weight: 2 }, { name: "Cuối kỳ", key: "ck", weight: 3 }],
  ielts: [{ name: "Listening", key: "listening", weight: 1 }, { name: "Reading", key: "reading", weight: 1 }, { name: "Writing", key: "writing", weight: 1 }, { name: "Speaking", key: "speaking", weight: 1 }],
};

export const createTemplate = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const name = str(fd, "name");
  if (!name) throw new Error("Nhập tên bộ điểm");
  if (await db.gradeTemplate.findFirst({ where: { name } })) throw new Error("Tên bộ điểm đã tồn tại");
  const cols = PRESETS[str(fd, "preset")] ?? [];
  await db.gradeTemplate.create({
    data: { name, ranks: DEFAULT_RANKS, columns: { create: cols.map((c, i) => ({ ...c, order: i, maxScore: 10 })) } },
  });
  revalidatePath("/bang-diem");
});

export const updateTemplate = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  const cols = await db.gradeColumn.findMany({ where: { templateId: id } });
  const formula = str(fd, "formula");
  const err = validateFormula(formula, cols);
  if (err) throw new Error("Công thức sai: " + err);
  const scale = num(fd, "scale", 10);
  if (scale <= 0 || scale > 1000) throw new Error("Thang điểm không hợp lệ");
  let ranks;
  try { ranks = textToRanks(str(fd, "ranks")); } catch (e) { throw new Error((e as Error).message); }
  const name = str(fd, "name");
  const dup = await db.gradeTemplate.findFirst({ where: { name, id: { not: id } } });
  if (dup) throw new Error("Tên bộ điểm đã tồn tại");
  await db.gradeTemplate.update({
    where: { id },
    data: { name, description: opt(fd, "description"), formula, scale, missingAsZero: fd.get("missingAsZero") === "on", ranks },
  });
  revalidatePath("/bang-diem");
});

export const addColumn = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const templateId = str(fd, "templateId");
  const name = str(fd, "name");
  if (!name) throw new Error("Nhập tên cột điểm");
  const key = makeKey(name, str(fd, "key"));
  if (await db.gradeColumn.findUnique({ where: { templateId_key: { templateId, key } } })) throw new Error(`Mã cột "${key}" đã tồn tại`);
  const order = await db.gradeColumn.count({ where: { templateId } });
  await db.gradeColumn.create({ data: { templateId, name, key, weight: num(fd, "weight", 1), maxScore: num(fd, "maxScore", 10), order } });
  revalidatePath("/bang-diem");
  return `Đã thêm cột. Dùng mã "${key}" trong công thức.`;
});

export const updateColumn = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  const col = await db.gradeColumn.findUniqueOrThrow({ where: { id } });
  const key = makeKey(str(fd, "name"), str(fd, "key"));
  if (key !== col.key) {
    if (await db.gradeColumn.findUnique({ where: { templateId_key: { templateId: col.templateId, key } } })) throw new Error("Mã cột trùng");
    const t = await db.gradeTemplate.findUniqueOrThrow({ where: { id: col.templateId } });
    if (new RegExp(`\\b${col.key}\\b`).test(t.formula)) throw new Error(`Công thức đang dùng mã "${col.key}", hãy sửa công thức trước`);
  }
  const max = num(fd, "maxScore", 10);
  if (max <= 0) throw new Error("Điểm tối đa phải > 0");
  await db.gradeColumn.update({ where: { id }, data: { name: str(fd, "name"), key, weight: num(fd, "weight", 1), maxScore: max, order: Math.round(num(fd, "order", col.order)) } });
  revalidatePath("/bang-diem");
});

export const deleteColumn = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const col = await db.gradeColumn.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  const t = await db.gradeTemplate.findUniqueOrThrow({ where: { id: col.templateId } });
  if (new RegExp(`\\b${col.key}\\b`).test(t.formula)) throw new Error(`Công thức đang dùng mã "${col.key}", hãy sửa công thức trước`);
  await db.gradeColumn.delete({ where: { id: col.id } });
  revalidatePath("/bang-diem");
});

export const duplicateTemplate = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const t = await db.gradeTemplate.findUniqueOrThrow({ where: { id: str(fd, "id") }, include: { columns: true } });
  let name = `${t.name} (bản sao)`;
  for (let i = 2; await db.gradeTemplate.findFirst({ where: { name } }); i++) name = `${t.name} (bản sao ${i})`;
  await db.gradeTemplate.create({
    data: { name, description: t.description, formula: t.formula, scale: t.scale, missingAsZero: t.missingAsZero, ranks: t.ranks as object,
      columns: { create: t.columns.map(({ name, key, weight, maxScore, order }) => ({ name, key, weight, maxScore, order })) } },
  });
  revalidatePath("/bang-diem");
});

export const deleteTemplate = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const id = str(fd, "id");
  if (await db.class.count({ where: { gradeTemplateId: id } })) throw new Error("Bộ điểm đang được dùng ở lớp, hãy gỡ khỏi lớp trước");
  await db.gradeTemplate.delete({ where: { id } });
  revalidatePath("/bang-diem");
  redirect("/bang-diem");
});

/** Áp dụng bộ điểm cho nhiều lớp cùng lúc. */
export const applyTemplate = wrap(async (fd) => {
  await assertRole(...STAFF_ROLES);
  const ids = fd.getAll("classId").map(String);
  if (!ids.length) throw new Error("Chọn ít nhất 1 lớp");
  const tid = str(fd, "templateId") || null;
  await db.class.updateMany({ where: { id: { in: ids } }, data: { gradeTemplateId: tid } });
  revalidatePath("/bang-diem");
  return `Đã áp dụng cho ${ids.length} lớp`;
});
