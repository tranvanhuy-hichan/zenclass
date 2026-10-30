import Link from "next/link";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Title } from "@/components/ui";
import { StudentFields } from "@/components/person-fields";
import { createStudent, importStudents } from "../actions";

export default async function NewStudent() {
  await requireRole(...STAFF_ROLES);
  return (
    <div className=" space-y-4">
      <Title right={<Link href="/hoc-vien" className="hidden text-sm underline md:inline">← Danh sách học viên</Link>}>Thêm học viên</Title>
      <ActionForm action={createStudent} submit="Lưu học viên & tạo tài khoản" className="space-y-4 w-full"><StudentFields /></ActionForm>
      <Card>
        <h2 className="mb-2 font-semibold">Hoặc nhập nhiều học viên cùng lúc</h2>
        <p className="mb-2 text-sm text-slate-500">Dán từ Excel, mỗi dòng một học viên: Họ tên, SĐT học viên, SĐT phụ huynh.</p>
        <ActionForm action={importStudents} submit="Nhập danh sách" className="space-y-2 w-full">
          <textarea name="data" rows={5} className="w-full rounded-md border px-3 py-2 text-sm" placeholder={"Nguyễn Văn A, 0901234567, 0912345678"} />
        </ActionForm>
      </Card>
    </div>
  );
}
