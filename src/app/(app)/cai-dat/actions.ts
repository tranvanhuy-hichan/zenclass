"use server";
import { revalidatePath } from "next/cache";
import { currentTenantId, db } from "@/lib/db";
import { assertRole } from "@/lib/guard";
import { wrap, str, int } from "@/lib/action";
import { parseDate } from "@/lib/format";
import { getSettings, saveSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { appUrl, confirmWebhook } from "@/lib/payos";
import { getTenantPayos, packPayos } from "@/lib/tenant-payos";

export const saveCenter = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const acc = str(fd, "account").replace(/\s/g, "");
  if (acc && !/^\d{4,20}$/.test(acc)) throw new Error("Số tài khoản không hợp lệ");
  const cur = await getSettings();
  await saveSettings({
    ...cur, name: str(fd, "name") || cur.name, maxEditDays: int(fd, "maxEditDays", 7),
    address: str(fd, "address"), phone: str(fd, "phone"), taxCode: str(fd, "taxCode"),
    bank: { bank: str(fd, "bank").toUpperCase(), account: acc, name: str(fd, "accName").toUpperCase() },
  });
  await audit(me.id, "settings", "Setting");
  revalidatePath("/cai-dat");
});

export const addHoliday = wrap(async (fd) => {
  await assertRole("ADMIN");
  if (!str(fd, "date")) throw new Error("Chọn ngày");
  const tenantId = (await currentTenantId())!;
  await db.holiday.upsert({ where: { tenantId_date: { tenantId, date: parseDate(str(fd, "date")) } }, update: { name: str(fd, "name") }, create: { date: parseDate(str(fd, "date")), name: str(fd, "name") || "Nghỉ lễ" } });
  revalidatePath("/cai-dat");
  return "Đã thêm. Lịch các lớp sẽ áp dụng khi sinh lại buổi học.";
});

export const deleteHoliday = wrap(async (fd) => {
  await assertRole("ADMIN");
  await db.holiday.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/cai-dat");
});

/** Lưu / bật / tắt kênh PayOS của trung tâm (khoá được mã hoá khi lưu). Để trống 3 ô khoá = giữ khoá cũ, chỉ đổi trạng thái bật. */
export const savePayos = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const tenantId = (await currentTenantId())!;
  const clientId = str(fd, "clientId"), apiKey = str(fd, "apiKey"), checksumKey = str(fd, "checksumKey");
  const enabled = fd.get("enabled") === "on";
  const old = await getTenantPayos({ includeDisabled: true });
  let keys = old?.keys;
  if (clientId || apiKey || checksumKey) {
    if (!clientId || !apiKey || !checksumKey) throw new Error("Nhập đủ cả 3 khoá: Client ID, API Key, Checksum Key");
    keys = { clientId, apiKey, checksumKey };
  }
  if (!keys) throw new Error("Chưa có khoá PayOS. Nhập Client ID, API Key và Checksum Key của kênh thanh toán.");
  const value = packPayos(keys, enabled);
  await db.setting.upsert({ where: { tenantId_key: { tenantId, key: "payos" } }, update: { value }, create: { tenantId, key: "payos", value } });
  await audit(me.id, "payos-settings", "Setting");
  revalidatePath("/cai-dat");
  return enabled ? "Đã lưu. Học viên sẽ thanh toán online qua PayOS và hệ thống tự gạch nợ." : "Đã lưu và tắt thanh toán online. Phiếu học phí dùng mã VietQR như trước.";
});

export const removePayos = wrap(async () => {
  const me = await assertRole("ADMIN");
  await db.setting.deleteMany({ where: { key: "payos" } });
  await audit(me.id, "payos-remove", "Setting");
  revalidatePath("/cai-dat");
  return "Đã xoá khoá PayOS";
});

/** Đăng ký địa chỉ webhook của trung tâm lên PayOS (cần địa chỉ công khai có HTTPS). */
export const registerPayosWebhook = wrap(async () => {
  await assertRole("ADMIN");
  const cfg = await getTenantPayos({ includeDisabled: true });
  if (!cfg) throw new Error("Hãy lưu khoá PayOS trước");
  const url = `${appUrl()}/api/webhook/payos/t/${(await currentTenantId())!}`;
  if (!url.startsWith("https://")) throw new Error("PayOS chỉ nhận địa chỉ công khai có HTTPS. Hệ thống đang chạy ở địa chỉ nội bộ nên chưa đăng ký được; khi triển khai lên tên miền thật, bấm lại nút này.");
  await confirmWebhook(cfg.keys, url);
  return `Đã đăng ký webhook: ${url}`;
});

const LOGO_URL = /^\/api\/files\/([a-z0-9]+)$/;

/** Đặt logo riêng của trung tâm (ảnh đã được thu nhỏ ở trình duyệt). Logo cũ bị xoá khỏi kho. */
export const saveLogo = wrap(async (fd) => {
  const me = await assertRole("ADMIN");
  const f = fd.get("file");
  if (!(f instanceof File) || !f.size) throw new Error("Chọn ảnh logo");
  if (!/^image\/(png|jpeg|webp)$/.test(f.type)) throw new Error("Logo phải là ảnh PNG, JPG hoặc WebP");
  if (f.size > 500_000) throw new Error("Logo tối đa 500 KB");
  const cur = await getSettings();
  const file = await db.storedFile.create({ data: { name: f.name.slice(0, 80) || "logo", mime: f.type, size: f.size, data: Buffer.from(await f.arrayBuffer()), isPublic: true, createdBy: me.id } });
  await saveSettings({ ...cur, theme: { ...cur.theme, logo: `/api/files/${file.id}` } });
  const old = LOGO_URL.exec(cur.theme.logo)?.[1];
  if (old) await db.storedFile.deleteMany({ where: { id: old } });
  await audit(me.id, "logo", "Setting");
  revalidatePath("/", "layout");
  return "Đã cập nhật logo. Biểu tượng trên thẻ trình duyệt sẽ đổi ở lần tải trang tiếp theo.";
});

/** Quay về logo mặc định của hệ thống. */
export const removeLogo = wrap(async () => {
  const me = await assertRole("ADMIN");
  const cur = await getSettings();
  const old = LOGO_URL.exec(cur.theme.logo)?.[1];
  await saveSettings({ ...cur, theme: { ...cur.theme, logo: "" } });
  if (old) await db.storedFile.deleteMany({ where: { id: old } });
  await audit(me.id, "logo-remove", "Setting");
  revalidatePath("/", "layout");
  return "Đã dùng logo mặc định của hệ thống";
});
