import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Table, Title } from "@/components/ui";
import { DialogButton } from "@/components/dialog";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { createStaff, adminResetPassword, toggleUser } from "./actions";

export default async function Staff({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; size?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const { q } = sp;
  const pg = getPaging(sp);
  const where = q ? { OR: [{ username: { contains: q, mode: "insensitive" as const } }, { fullName: { contains: q, mode: "insensitive" as const } }] } : {};
  const [total, users] = await Promise.all([db.user.count({ where }), db.user.findMany({ where, orderBy: [{ role: "asc" }, { fullName: "asc" }], skip: pg.skip, take: pg.take })]);
  return (
    <div className="space-y-4">
      <Title right={<DialogButton label="+ Thêm nhân viên" title="Thêm nhân viên / quản trị">
        <ActionForm action={createStaff} submit="Tạo tài khoản" className="flex flex-col gap-3 [&>button]:self-start">
          <Field label="Họ tên"><input name="fullName" className={inputCls + " w-full"} required /></Field>
          <Field label="Tên đăng nhập"><input name="username" className={inputCls + " w-full"} required /></Field>
          <Field label="Vai trò"><select name="role" className={inputCls + " w-full"}><option value="STAFF">Nhân viên</option><option value="ADMIN">Quản trị</option></select></Field>
        </ActionForm>
      </DialogButton>}>Nhân viên & Tài khoản</Title>
      <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Tìm tài khoản..." className={inputCls + " flex-1"} /><button className="px-4 rounded-lg border bg-white text-sm">Tìm</button></form>
      <Table head={["Tên", "Đăng nhập", "Vai trò", "Trạng thái", ""]}>
        {users.map((u) => (
          <tr key={u.id}>
            <td>{u.fullName}</td><td>{u.username}</td><td>{u.role}</td>
            <td>{u.isActive ? "Hoạt động" : "Đã khoá"}</td>
            <td className="flex gap-2">
              <ActionForm action={adminResetPassword} submit="Reset MK" className="flex gap-2 items-center" reset={false}><input type="hidden" name="userId" value={u.id} /></ActionForm>
              <ActionForm action={toggleUser} submit={u.isActive ? "Khoá" : "Mở"} danger={u.isActive} className="flex gap-2 items-center"><input type="hidden" name="userId" value={u.id} /></ActionForm>
            </td>
          </tr>
        ))}
      </Table>
      <Pagination total={total} page={pg.page} size={pg.size} path="/nhan-vien" params={{ q, size: sp.size }} />
    </div>
  );
}
