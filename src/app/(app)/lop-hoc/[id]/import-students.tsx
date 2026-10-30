"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { useDialogClose } from "@/components/dialog";
import { importStudents } from "../actions";

type Row = { fullName: string; username: string; password: string; parentUsername: string; parentPassword: string; status: string };
const q = (v: string) => `"${v.replace(/"/g, '""')}"`;

function download(rows: Row[], className: string) {
  const head = ["Họ tên", "Tên đăng nhập", "Mật khẩu", "Tài khoản phụ huynh", "Mật khẩu phụ huynh", "Ghi chú"];
  const body = rows.map((r) => [r.fullName, r.username, r.password, r.parentUsername, r.parentPassword, r.status].map(q).join(","));
  const blob = new Blob(["﻿" + [head.map(q).join(","), ...body].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tai-khoan-${className.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/\W+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Dán danh sách học viên → tạo tài khoản HVxxxxxxxx, ghi danh và tự tải file mật khẩu. */
export function ImportStudents({ classId }: { classId: string }) {
  const [res, action, pending] = useActionState(importStudents, null);
  const [text, setText] = useState("");
  const done = useRef<unknown>(null);
  const close = useDialogClose();
  const n = text.split(/\r?\n/).filter((l) => l.trim()).length;

  useEffect(() => {
    if (!res?.data?.rows || done.current === res) return;
    done.current = res;
    download(JSON.parse(res.data.rows), res.data.className);
    setText("");
  }, [res]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="classId" value={classId} />
      <div className="text-sm text-slate-600">
        Mỗi dòng một học viên: <b>Họ tên</b>, SĐT học viên, Tên phụ huynh, SĐT phụ huynh (chỉ cần họ tên). Dán thẳng từ Excel được.
        <pre className="mt-1 rounded bg-slate-100 px-3 py-2 text-xs">{"Nguyễn Văn An\nTrần Thị Bình, 0912345678, Trần Văn Cường, 0987654321"}</pre>
      </div>
      <textarea name="list" value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Dán danh sách học viên vào đây..." className="w-full rounded-md border bg-white p-3 text-sm" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border bg-white px-3 text-sm hover:bg-slate-50">
          <FileUp className="size-4" /> Mở file .csv / .txt
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); e.target.value = ""; }} />
        </label>
        <span className="text-sm text-slate-500">{n} học viên</span>
        <button disabled={pending || !n} className="ml-auto h-9 rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">{pending ? "Đang tạo..." : `Tạo ${n || ""} tài khoản & ghi danh`}</button>
      </div>
      {res?.error && <p className="text-sm text-red-600">{res.error}</p>}
      {res?.ok && (
        <div className="space-y-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          <p>{res.ok}</p>
          <div className="flex gap-2">
            {res.data?.rows && <button type="button" onClick={() => download(JSON.parse(res.data!.rows), res.data!.className)} className="h-8 rounded-md border bg-white px-3 text-xs text-slate-700">Tải lại file</button>}
            <button type="button" onClick={() => close?.()} className="h-8 rounded-md border bg-white px-3 text-xs text-slate-700">Đóng</button>
          </div>
        </div>
      )}
    </form>
  );
}
