import Link from "next/link";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Title } from "@/components/ui";
import { TeacherFields } from "@/components/person-fields";
import { createTeacher } from "../actions";

export default async function NewTeacher() {
  const me = await requireRole(...STAFF_ROLES);
  return (
    <div className=" space-y-4">
      <Title right={<Link href="/giao-vien" className="hidden text-sm underline md:inline">← Danh sách giáo viên</Link>}>Thêm giáo viên</Title>
      <ActionForm action={createTeacher} submit="Lưu giáo viên" className="space-y-4 w-full"><TeacherFields create showPay={me.role === "ADMIN"} /></ActionForm>
    </div>
  );
}
