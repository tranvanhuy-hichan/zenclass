import { db } from "@/lib/db";
import { ViewToggle, pickView } from "@/components/view-toggle";
import { AutoForm } from "@/components/auto-form";
import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Field, inputCls, Table, Title } from "@/components/ui";
import { DialogButton } from "@/components/dialog";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { createStaff, adminResetPassword, toggleUser } from "./actions";

export default async function Staff({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; size?: string; v?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const { q } = sp;
  const view = pickView(sp.v, "table");
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
      <AutoForm className="flex gap-2"><input type="hidden" name="v" value={view} /><input name="q" defaultValue={q} placeholder="Tìm tài khoản..." className={inputCls + " min-w-0 flex-1"} /><div className="hidden md:block"><ViewToggle path="/nhan-vien" params={{ q, size: sp.size }} view={view} /></div></AutoForm>
      {view !== "cards" && (
        <div className="md:hidden">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {users.map((u) => (
            <div key={u.id} className={`flex flex-col gap-3 rounded-lg border bg-white p-4 ${u.isActive ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-orange-100 text-base font-bold text-orange-700">{u.fullName.split(" ").pop()?.[0]}</span>
                <div className="min-w-0"><div className="truncate font-semibold">{u.fullName}</div><div className="truncate text-xs text-slate-500">{u.username} · {u.role}</div></div>
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className={u.isActive ? "text-green-700" : "text-red-600"}>{u.isActive ? "Hoạt động" : "Đã khoá"}</span>
                <div className="flex gap-2">
                  <ActionForm action={adminResetPassword} submit="Reset MK" compact className="flex gap-2 items-center" reset={false}><input type="hidden" name="userId" value={u.id} /></ActionForm>
                  <ActionForm action={toggleUser} submit={u.isActive ? "Khoá" : "Mở"} compact danger={u.isActive} className="flex gap-2 items-center"><input type="hidden" name="userId" value={u.id} /></ActionForm>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      )}
      {view === "table" ? (
        <div className="hidden md:block"><Table head={["Tên", "Đăng nhập", "Vai trò", "Trạng thái", ""]}>
        {users.map((u) => (
          <tr key={u.id}>
            <td>{u.fullName}</td><td>{u.username}</td><td>{u.role}</td>
            <td>{u.isActive ? "Hoạt động" : "Đã khoá"}</td>
            <td className="flex gap-2">
              <ActionForm action={adminResetPassword} submit="Reset MK" compact className="flex gap-2 items-center" reset={false}><input type="hidden" name="userId" value={u.id} /></ActionForm>
              <ActionForm action={toggleUser} submit={u.isActive ? "Khoá" : "Mở"} compact danger={u.isActive} className="flex gap-2 items-center"><input type="hidden" name="userId" value={u.id} /></ActionForm>
            </td>
          </tr>
        ))}
      </Table></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {users.map((u) => (
            <div key={u.id} className={`flex flex-col gap-3 rounded-lg border bg-white p-4 ${u.isActive ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-orange-100 text-base font-bold text-orange-700">{u.fullName.split(" ").pop()?.[0]}</span>
                <div className="min-w-0"><div className="truncate font-semibold">{u.fullName}</div><div className="truncate text-xs text-slate-500">{u.username} · {u.role}</div></div>
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className={u.isActive ? "text-green-700" : "text-red-600"}>{u.isActive ? "Hoạt động" : "Đã khoá"}</span>
                <div className="flex gap-2">
                  <ActionForm action={adminResetPassword} submit="Reset MK" compact className="flex gap-2 items-center" reset={false}><input type="hidden" name="userId" value={u.id} /></ActionForm>
                  <ActionForm action={toggleUser} submit={u.isActive ? "Khoá" : "Mở"} compact danger={u.isActive} className="flex gap-2 items-center"><input type="hidden" name="userId" value={u.id} /></ActionForm>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination total={total} page={pg.page} size={pg.size} path="/nhan-vien" params={{ q, size: sp.size, v: sp.v }} />
    </div>
  );
}
