import { requireRole } from "@/lib/guard";
import { db, rootDb } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Title } from "@/components/ui";
import { changeMyPassword } from "../nhan-vien/actions";

export default async function ChangePassword() {
  const me = await requireRole();
  const forced = !!(await (me.role === "SUPERADMIN" ? rootDb : db).user.findUnique({ where: { id: me.id }, select: { mustChangePwd: true } }))?.mustChangePwd;
  return (
    <div className=" space-y-4">
      <Title>{forced ? "Đặt mật khẩu mới" : "Đổi mật khẩu"}</Title>
      {forced && <Card className="border-orange-300 text-sm">Đây là lần đăng nhập đầu tiên (hoặc mật khẩu vừa được cấp lại). Hãy nhập mật khẩu được cấp ở ô &ldquo;hiện tại&rdquo; và đặt mật khẩu mới của bạn để tiếp tục.</Card>}
      <Card><ActionForm action={changeMyPassword} submit="Đổi mật khẩu">
        <Field label="Mật khẩu hiện tại"><input name="old" type="password" className={inputCls} required /></Field>
        <Field label="Mật khẩu mới (tối thiểu 6 ký tự)"><input name="new" type="password" className={inputCls} required /></Field>
      </ActionForm></Card>
    </div>
  );
}
