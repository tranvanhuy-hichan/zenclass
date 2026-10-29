import { Field, inputCls } from "@/components/ui";
import { isoDate } from "@/lib/format";

const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="w-full rounded-lg border p-4">
    <legend className="px-2 text-sm font-semibold">{title}</legend>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>
  </fieldset>
);
const T = (name: string, label: string, v?: string | null, extra: object = {}) => (
  <Field label={label}><input name={name} defaultValue={v ?? ""} className={inputCls + " w-full"} {...extra} /></Field>
);
const Gender = ({ v }: { v?: string | null }) => (
  <Field label="Giới tính"><select name="gender" defaultValue={v ?? ""} className={inputCls + " w-full"}><option value="">--</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></Field>
);

type S = { fullName?: string; gender?: string | null; dob?: Date | null; phone?: string | null; email?: string | null; address?: string | null; school?: string | null; gradeLevel?: string | null; source?: string | null; emergencyContact?: string | null; note?: string | null; avatarUrl?: string | null };
type P = { fullName?: string | null; phone?: string | null; email?: string | null; address?: string | null; job?: string | null; relation?: string | null };

export function StudentFields({ s = {}, p = {} }: { s?: S; p?: P }) {
  return (
    <>
      <Sec title="Thông tin học viên">
        {T("fullName", "Họ và tên *", s.fullName, { required: true })}
        <Gender v={s.gender} />
        <Field label="Ngày sinh"><input type="date" name="dob" defaultValue={s.dob ? isoDate(s.dob) : ""} className={inputCls + " w-full"} /></Field>
        {T("phone", "SĐT học viên", s.phone)}
        {T("email", "Email", s.email, { type: "email" })}
        {T("address", "Địa chỉ", s.address)}
        {T("school", "Trường đang học", s.school)}
        {T("gradeLevel", "Lớp / Khối (vd: Lớp 7)", s.gradeLevel)}
        {T("source", "Nguồn biết đến trung tâm", s.source)}
        {T("avatarUrl", "Ảnh đại diện (link)", s.avatarUrl)}
      </Sec>
      <Sec title="Phụ huynh / Người giám hộ">
        {T("parentName", "Họ tên phụ huynh", p.fullName)}
        {T("parentPhone", "SĐT phụ huynh (dùng để đăng nhập app PH)", p.phone)}
        <Field label="Quan hệ"><select name="parentRelation" defaultValue={p.relation ?? ""} className={inputCls + " w-full"}><option value="">--</option><option>Bố</option><option>Mẹ</option><option>Ông/Bà</option><option>Người giám hộ</option><option>Khác</option></select></Field>
        {T("parentEmail", "Email phụ huynh", p.email, { type: "email" })}
        {T("parentJob", "Nghề nghiệp", p.job)}
        {T("parentAddress", "Địa chỉ phụ huynh", p.address)}
        {T("emergencyContact", "Liên hệ khẩn cấp (tên - SĐT)", s.emergencyContact)}
      </Sec>
      <Sec title="Ghi chú">
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Ghi chú nội bộ (sức khoẻ, tính cách, mục tiêu...)"><textarea name="note" rows={3} defaultValue={s.note ?? ""} className={inputCls + " h-auto w-full py-2"} /></Field></div>
      </Sec>
    </>
  );
}

type Tc = { fullName?: string; gender?: string | null; dob?: Date | null; phone?: string | null; email?: string | null; address?: string | null; idNumber?: string | null; degree?: string | null; specialty?: string | null; bankName?: string | null; bankAccount?: string | null; startDate?: Date | null; payType?: string; payRate?: number; note?: string | null; avatarUrl?: string | null };

export function TeacherFields({ t = {}, create = false }: { t?: Tc; create?: boolean }) {
  return (
    <>
      <Sec title="Thông tin cá nhân">
        {T("fullName", "Họ và tên *", t.fullName, { required: true })}
        <Gender v={t.gender} />
        <Field label="Ngày sinh"><input type="date" name="dob" defaultValue={t.dob ? isoDate(t.dob) : ""} className={inputCls + " w-full"} /></Field>
        {T("phone", "Số điện thoại", t.phone)}
        {T("email", "Email", t.email, { type: "email" })}
        {T("idNumber", "Số CCCD / CMND", t.idNumber)}
        {T("address", "Địa chỉ", t.address)}
        {T("avatarUrl", "Ảnh đại diện (link)", t.avatarUrl)}
      </Sec>
      <Sec title="Chuyên môn">
        {T("degree", "Trình độ / Bằng cấp (vd: Cử nhân Sư phạm Anh, IELTS 8.0)", t.degree)}
        {T("specialty", "Chuyên môn / Môn dạy", t.specialty)}
        <Field label="Ngày bắt đầu làm việc"><input type="date" name="startDate" defaultValue={t.startDate ? isoDate(t.startDate) : ""} className={inputCls + " w-full"} /></Field>
      </Sec>
      <Sec title="Lương & Tài khoản ngân hàng">
        <Field label="Kiểu tính lương"><select name="payType" defaultValue={t.payType ?? "PER_SESSION"} className={inputCls + " w-full"}><option value="PER_SESSION">Theo buổi</option><option value="PER_HOUR">Theo giờ</option><option value="FIXED">Cố định / tháng</option></select></Field>
        {T("payRate", "Mức lương (đ)", String(t.payRate ?? 0), { inputMode: "numeric" })}
        {T("bankName", "Ngân hàng", t.bankName)}
        {T("bankAccount", "Số tài khoản", t.bankAccount)}
      </Sec>
      {create && (
        <Sec title="Tài khoản đăng nhập">
          {T("username", "Tên đăng nhập (mặc định = SĐT; để trống cả hai = không tạo tài khoản)")}
          <p className="text-xs text-slate-500 self-end pb-2">Mật khẩu được tạo tự động và hiện một lần sau khi lưu.</p>
        </Sec>
      )}
      <Sec title="Ghi chú">
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Ghi chú nội bộ"><textarea name="note" rows={3} defaultValue={t.note ?? ""} className={inputCls + " h-auto w-full py-2"} /></Field></div>
      </Sec>
    </>
  );
}
