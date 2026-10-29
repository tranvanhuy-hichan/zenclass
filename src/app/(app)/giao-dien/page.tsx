import { requireRole } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Title } from "@/components/ui";
import { ThemeEditor } from "./editor";

export default async function ThemePage() {
  await requireRole("ADMIN");
  const s = await getSettings();
  return (
    <div className="space-y-4">
      <Title>Giao diện hệ thống</Title>
      <p className="text-sm text-gray-500">Thay đổi hiển thị ngay khi chỉnh; bấm “Lưu” để áp dụng cho mọi người dùng.</p>
      <ThemeEditor initial={s.theme} name={s.name} />
    </div>
  );
}
