import { Card } from "@/components/ui";
import { fmtDate, fmtMoney, moneyToWords } from "@/lib/format";
import { vietQrUrl } from "@/lib/vietqr";
import { getSettings } from "@/lib/settings";

type Inv = { code: string; issueDate: Date; dueDate: Date | null; total: number; paid: number; status: string; note: string | null; student: { fullName: string; code: string }; items: { id: string; description: string; amount: number }[] };

export async function InvoiceView({ inv }: { inv: Inv }) {
  const st = await getSettings();
  const owed = inv.total - inv.paid;
  const hasBank = st.bank.account && st.bank.bank;
  return (
    <Card className="max-w-md mx-auto space-y-3">
      <div className="flex justify-between items-start">
        <div><h2 className="text-xl font-bold">PHIẾU BÁO HỌC PHÍ</h2><div className="text-xs text-gray-500">{st.name} · Ngày tạo: {fmtDate(inv.issueDate)}{inv.dueDate && ` · Hạn: ${fmtDate(inv.dueDate)}`}</div></div>
        <span className="bg-orange-100 text-orange-700 text-sm rounded-full px-3 py-1">{inv.student.code}</span>
      </div>
      <div className="flex justify-between text-sm"><span className="text-gray-500">Học viên</span><b>{inv.student.fullName}</b></div>
      <div className="bg-orange-50 rounded-lg p-3 space-y-1">
        {inv.items.map((i) => <div key={i.id} className="flex justify-between text-sm"><span>{i.description}</span><b>{fmtMoney(i.amount)}</b></div>)}
        {inv.note && <div className="text-xs text-gray-500">{inv.note}</div>}
      </div>
      <div className="flex justify-between items-center">
        <span className="text-lg font-bold">{owed > 0 ? "Cần thanh toán" : "Đã thanh toán"}</span>
        <span className="bg-red-50 text-red-600 font-bold rounded-lg px-3 py-2">{fmtMoney(owed > 0 ? owed : inv.total)}</span>
      </div>
      <div className="text-sm"><span className="text-gray-500">Số tiền bằng chữ: </span><b>{moneyToWords(owed > 0 ? owed : inv.total)}</b></div>
      {inv.status === "VOID" && <p className="text-red-600 font-bold">PHIẾU ĐÃ HUỶ</p>}
      {owed > 0 && inv.status !== "VOID" && (hasBank ? (
        <div className="border rounded-xl p-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="VietQR" className="mx-auto w-56" src={vietQrUrl({ bank: st.bank.bank, account: st.bank.account, name: st.bank.name, amount: owed, info: `HP ${inv.student.code} ${inv.code}` })} />
          <div className="text-xs text-gray-600 mt-1">{st.bank.name} · {st.bank.account} · {st.bank.bank}</div>
          <div className="text-sm font-medium mt-1">Nội dung CK: HP {inv.student.code} {inv.code}</div>
          <div className="text-xs text-gray-500">Quét mã bằng app ngân hàng để tự điền thông tin chuyển khoản.</div>
        </div>
      ) : <p className="text-sm text-gray-500">Chưa cài tài khoản ngân hàng (Cài đặt) nên chưa có mã QR.</p>)}
    </Card>
  );
}
