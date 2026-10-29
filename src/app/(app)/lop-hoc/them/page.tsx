import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Title } from "@/components/ui";
import { isoDate, todayUTC } from "@/lib/format";
import { createClass } from "../actions";
import { ClassFormFields } from "../class-fields";

export default async function NewClass() {
  await requireRole(...STAFF_ROLES);
  const [teachers, rooms, templates] = await Promise.all([
    db.teacher.findMany({ orderBy: { fullName: "asc" } }),
    db.room.findMany({ orderBy: { name: "asc" } }),
    db.gradeTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className=" space-y-4">
      <Title right={<Link href="/lop-hoc" className="text-sm underline">← Danh sách lớp</Link>}>Thêm lớp học</Title>
      <Card>
        <ActionForm action={createClass} submit="Tạo lớp & sinh buổi học" className="space-y-4 w-full">
          <ClassFormFields teachers={teachers} rooms={rooms} templates={templates} defaults={{ startDate: isoDate(todayUTC()) }} />
          <p className="text-xs text-slate-500">Sau khi tạo, hệ thống tự sinh các buổi học theo lịch và báo nếu trùng giáo viên/phòng. Thêm học viên vào lớp ở trang chi tiết lớp.</p>
        </ActionForm>
      </Card>
    </div>
  );
}
