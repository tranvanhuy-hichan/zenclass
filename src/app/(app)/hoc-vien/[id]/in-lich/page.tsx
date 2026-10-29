import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { StudentOverview } from "@/components/student-overview";
import { PrintButton } from "@/components/print-button";

export default async function PrintSchedule({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const s = await db.student.findUniqueOrThrow({ where: { id } });
  return (
    <div className=" mx-auto space-y-3">
      <h1 className="text-xl font-bold text-center">Lịch học của học viên: {s.fullName}</h1>
      <PrintButton />
      <StudentOverview studentId={id} invoiceBase="/tai-chinh" />
    </div>
  );
}
