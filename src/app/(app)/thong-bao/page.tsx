import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/guard";
import { DialogButton } from "@/components/dialog";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, Title } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { getPaging } from "@/lib/paging";
import { markAllRead, sendAnnouncement } from "./actions";

export default async function Notifications({ searchParams }: { searchParams: Promise<{ page?: string; size?: string }> }) {
  const me = await requireRole();
  const sp = await searchParams;
  const pg = getPaging(sp, 10);
  const [total, list, classes] = await Promise.all([
    db.notification.count({ where: { userId: me.id } }),
    db.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, skip: pg.skip, take: pg.take }),
    STAFF_ROLES.includes(me.role) ? db.class.findMany({ where: { finished: false }, orderBy: { name: "asc" } }) : [],
  ]);
  return (
    <div className="space-y-4">
      <Title right={<>
        <ActionForm action={markAllRead} submit="Đánh dấu đã đọc" reset={false} className="" />
        {STAFF_ROLES.includes(me.role) && <DialogButton label="+ Gửi thông báo" title="Gửi thông báo cho học viên / phụ huynh">
          <ActionForm action={sendAnnouncement} submit="Gửi" className="flex flex-col gap-3 [&>button]:self-start">
            <Field label="Gửi tới"><select name="classId" className={inputCls + " w-full"}><option value="">Tất cả học viên</option>{classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}</select></Field>
            <Field label="Tiêu đề"><input name="title" className={inputCls + " w-full"} /></Field>
            <Field label="Nội dung"><textarea name="body" rows={4} className="w-full rounded-md border bg-white px-3 py-2 text-sm" /></Field>
          </ActionForm>
        </DialogButton>}
      </>}>Thông báo</Title>
      {list.map((n) => (
        <Card key={n.id} className={n.read ? "" : "border-orange-400 bg-orange-50"}>
          <div className="font-medium">{n.title}</div><div className="text-sm">{n.body}</div>
          <div className="text-xs text-gray-500">{n.createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</div>
        </Card>
      ))}
      {!list.length && <p className="text-gray-500">Chưa có thông báo.</p>}
      <Pagination total={total} page={pg.page} size={pg.size} path="/thong-bao" params={{ size: sp.size }} />
    </div>
  );
}
