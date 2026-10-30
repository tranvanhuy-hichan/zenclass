import { revalidateTag, unstable_cache } from "next/cache";
import { rootDb } from "@/lib/db";

/**
 * Hồ sơ trung tâm (trạng thái, hạn dùng) được đọc ở MỌI lượt tải trang. Lưu đệm 60 giây trên máy chủ để các trang không
 * phải truy vấn CSDL mỗi lần; mọi chỗ thay đổi trung tâm gọi bustTenant() để cập nhật tức thì.
 */
type TenantRow = NonNullable<Awaited<ReturnType<typeof rootDb.tenant.findUnique>>>;

/**
 * unstable_cache lưu kết quả dạng JSON nên các trường ngày quay về thành CHUỖI khi lấy từ đệm.
 * Phải đổi lại thành Date, nếu không `expiresAt.getTime()` sẽ lỗi (đã gây "Application error" trên máy chủ thật).
 */
export async function getTenant(id: string): Promise<TenantRow | null> {
  const t = await unstable_cache(() => rootDb.tenant.findUnique({ where: { id } }), ["tenant", id], { tags: [`tenant:${id}`], revalidate: 60 })();
  if (!t) return null;
  return { ...t, createdAt: new Date(t.createdAt), expiresAt: t.expiresAt ? new Date(t.expiresAt) : null };
}

function bust(tag: string) {
  try { revalidateTag(tag); } catch { /* ngoài ngữ cảnh request (script) */ }
}
export const bustTenant = (id: string) => bust(`tenant:${id}`);
export const bustSettings = (id: string) => bust(`settings:${id}`);
