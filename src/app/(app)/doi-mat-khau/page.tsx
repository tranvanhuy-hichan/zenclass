import { requireRole } from "@/lib/guard";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Title } from "@/components/ui";
import { changeMyPassword } from "../nhan-vien/actions";

export default async function ChangePassword() {
  await requireRole();
  return (
    <div className=" space-y-4">
      <Title>Đổi mật khẩu</Title>
      <Card><ActionForm action={changeMyPassword} submit="Đổi mật khẩu">
        <Field label="Mật khẩu hiện tại"><input name="old" type="password" className={inputCls} required /></Field>
        <Field label="Mật khẩu mới (tối thiểu 6 ký tự)"><input name="new" type="password" className={inputCls} required /></Field>
      </ActionForm></Card>
    </div>
  );
}
