import { BarChart3, BookOpen, Bell, Building2, CalendarDays, ClipboardList, FileText, GraduationCap, Home, Landmark, Palette, Settings, Users, UserCog, Wallet, Clock, School, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/guard";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { title?: string; items: NavItem[] };

const home: NavItem = { href: "/", label: "Trang chủ", icon: Home };
const noti: NavItem = { href: "/thong-bao", label: "Thông báo", icon: Bell };
const docs: NavItem = { href: "/tai-lieu", label: "Tài liệu", icon: FileText };

const TRAIN: NavItem[] = [
  { href: "/lich-hoc", label: "Lịch học", icon: CalendarDays },
  { href: "/lop-hoc", label: "Lớp học", icon: School },
  { href: "/hoc-vien", label: "Học viên", icon: GraduationCap },
  { href: "/giao-vien", label: "Giáo viên", icon: Users },
  { href: "/phong-hoc", label: "Phòng học", icon: Building2 },
  { href: "/bang-diem", label: "Bộ điểm", icon: ClipboardList },
];

export const NAV: Record<Role, NavGroup[]> = {
  ADMIN: [
    { items: [home] },
    { title: "Đào tạo", items: TRAIN },
    { title: "Tài chính", items: [{ href: "/tai-chinh", label: "Học phí & Chi phí", icon: Wallet }, { href: "/bao-cao", label: "Báo cáo", icon: BarChart3 }, { href: "/cong", label: "Chấm công / Lương", icon: Clock }] },
    { title: "Hệ thống", items: [{ href: "/nhan-vien", label: "Nhân viên & Tài khoản", icon: UserCog }, docs, noti, { href: "/giao-dien", label: "Giao diện", icon: Palette }, { href: "/cai-dat", label: "Cài đặt", icon: Settings }] },
  ],
  STAFF: [
    { items: [home] },
    { title: "Đào tạo", items: TRAIN },
    { title: "Tài chính", items: [{ href: "/tai-chinh", label: "Học phí & Chi phí", icon: Wallet }, { href: "/bao-cao", label: "Báo cáo", icon: BarChart3 }] },
    { title: "Khác", items: [docs, noti] },
  ],
  TEACHER: [{ items: [{ ...home, label: "Lịch dạy hôm nay" }, { href: "/lich-hoc", label: "Lịch dạy", icon: CalendarDays }, { href: "/lop-cua-toi", label: "Lớp & nhập điểm", icon: ClipboardList }, { href: "/cong", label: "Công của tôi", icon: Clock }, docs, noti] }],
  STUDENT: [{ items: [{ ...home, label: "Của tôi" }, docs, noti] }],
  PARENT: [{ items: [{ ...home, label: "Con của tôi" }, noti] }],
};

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Quản trị", STAFF: "Nhân viên", TEACHER: "Giáo viên", STUDENT: "Học viên", PARENT: "Phụ huynh" };

const TITLES: Record<string, string> = {
  "lich-hoc": "Lịch học", "lop-hoc": "Lớp học", "hoc-vien": "Học viên", "giao-vien": "Giáo viên", "phong-hoc": "Phòng học", "bang-diem": "Bộ điểm",
  "tai-chinh": "Tài chính", "bao-cao": "Báo cáo", cong: "Chấm công", "nhan-vien": "Nhân viên & Tài khoản", "tai-lieu": "Tài liệu", "thong-bao": "Thông báo",
  "giao-dien": "Giao diện", "cai-dat": "Cài đặt", "doi-mat-khau": "Đổi mật khẩu", "diem-danh": "Điểm danh", diem: "Bảng điểm", "in-lich": "In lịch", "lop-cua-toi": "Lớp của tôi", "hoa-don": "Học phí", them: "Thêm mới",
};
export const titleOf = (seg: string) => TITLES[seg];
export { BookOpen, Landmark };
