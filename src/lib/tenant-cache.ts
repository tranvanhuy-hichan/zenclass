import { revalidateTag, unstable_cache } from "next/cache";
import { rootDb } from "@/lib/db";

/**
 * Hồ sơ trung tâm (trạng thái, hạn dùng) được đọc ở MỌI lượt tải trang. Lưu đệm 60 giây trên máy chủ để các trang không
 * phải truy vấn CSDL mỗi lần; mọi chỗ thay đổi trung tâm gọi bustTenant() để cập nhật tức thì.
 */
export const getTenant = (id: string) =>
  unstable_cache(() => rootDb.tenant.findUnique({ where: { id } }), ["tenant", id], { tags: [`tenant:${id}`], revalidate: 60 })();

function bust(tag: string) {
  try { revalidateTag(tag); } catch { /* ngoài ngữ cảnh request (script) */ }
}
export const bustTenant = (id: string) => bust(`tenant:${id}`);
export const bustSettings = (id: string) => bust(`settings:${id}`);
