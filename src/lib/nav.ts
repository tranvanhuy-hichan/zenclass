import { Building, Layers, CalendarCheck, PenLine, Repeat, UserCheck, ClipboardCheck, BarChart3, BookOpen, Bell, Building2, CalendarDays, ClipboardList, FileText, GraduationCap, Home, Landmark, Palette, Settings, Users, UserCog, Wallet, Clock, School, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/guard";

export type NavItem = { href: string; label: string; icon: LucideIcon; children?: NavItem[] };
export type NavGroup = { title?: string; items: NavItem[] };

const home: NavItem = { href: "/", label: "Trang chủ", icon: Home };
const noti: NavItem = { href: "/thong-bao", label: "Thông báo", icon: Bell };
const docs: NavItem = { href: "/tai-lieu", label: "Tài liệu", icon: FileText };

const TRAIN: NavItem[] = [
  { href: "/lich-hoc", label: "Lịch học", icon: CalendarDays },
  { href: "/lop-hoc", label: "Lớp học", icon: School },
  { href: "/hoc-vien", label: "Học viên", icon: GraduationCap },
  { href: "/phan-cong", label: "Phân công dạy", icon: Repeat },
  { href: "/nhap-diem", label: "Nhập điểm", icon: PenLine },
  {
    href: "#nhan-su", label: "Nhân sự", icon: Users, children: [
      { href: "/giao-vien", label: "Giáo viên", icon: Users },
      { href: "/tro-giang", label: "Trợ giảng", icon: UserCheck },
      { href: "/giao-vu", label: "Giáo vụ", icon: ClipboardCheck },
    ],
  },
  {
    href: "#danh-muc", label: "Danh mục", icon: Layers, children: [
      { href: "/khoa-hoc", label: "Khoá học", icon: Layers },
      { href: "/co-so", label: "Cơ sở", icon: Building },
      { href: "/phong-hoc", label: "Phòng học", icon: Building2 },
      { href: "/bang-diem", label: "Bộ điểm", icon: ClipboardList },
    ],
  },
];

export const NAV: Record<Role, NavGroup[]> = {
  SUPERADMIN: [
    { items: [{ href: "/platform/tong-quan", label: "Tổng quan", icon: BarChart3 }] },
    { title: "Quản lý", items: [{ href: "/platform/trung-tam", label: "Trung tâm", icon: Building2 }, { href: "/platform/don-hang", label: "Đơn hàng", icon: Wallet }, { href: "/platform/cau-hinh", label: "Gói & thanh toán", icon: Settings }] },
  ],
  ADMIN: [
    { items: [home] },
    { title: "Đào tạo", items: TRAIN },
    { title: "Tài chính", items: [{ href: "/tai-chinh", label: "Học phí & Chi phí", icon: Wallet }, { href: "/bao-cao", label: "Báo cáo", icon: BarChart3 }, { href: "/cong", label: "Chấm công / Lương", icon: Clock }] },
    { title: "Hệ thống", items: [{ href: "/nhan-vien", label: "Nhân viên & Tài khoản", icon: UserCog }, docs, noti, { href: "/goi-dich-vu", label: "Gói dịch vụ", icon: Landmark }, { href: "/giao-dien", label: "Giao diện", icon: Palette }, { href: "/cai-dat", label: "Cài đặt", icon: Settings }] },
  ],
  STAFF: [
    { items: [home] },
    { title: "Đào tạo", items: TRAIN },
    { title: "Tài chính", items: [{ href: "/tai-chinh", label: "Học phí & Chi phí", icon: Wallet }, { href: "/bao-cao", label: "Báo cáo", icon: BarChart3 }] },
    { title: "Khác", items: [{ href: "/cong", label: "Lương của tôi", icon: Clock }, docs, noti] },
  ],
  TEACHER: [{ items: [{ ...home, label: "Lịch dạy hôm nay" }, { href: "/lich-hoc", label: "Lịch học", icon: CalendarDays }, { href: "/lop-cua-toi", label: "Lớp của tôi", icon: School }, { href: "/nhap-diem", label: "Nhập điểm", icon: PenLine }, { href: "/cong", label: "Công của tôi", icon: Clock }, docs, noti] }],
  STUDENT: [{ items: [{ ...home, label: "Tổng quan" }, { href: "/lich-hoc", label: "Lịch học", icon: CalendarDays }, { href: "/diem-danh-cua-toi", label: "Điểm danh", icon: CalendarCheck }, { href: "/diem-cua-toi", label: "Bảng điểm", icon: ClipboardList }, { href: "/hoc-phi-cua-toi", label: "Học phí", icon: Wallet }, docs, noti] }],
  PARENT: [{ items: [{ ...home, label: "Tổng quan" }, { href: "/lich-hoc", label: "Lịch học", icon: CalendarDays }, { href: "/diem-danh-cua-toi", label: "Điểm danh", icon: CalendarCheck }, { href: "/diem-cua-toi", label: "Bảng điểm", icon: ClipboardList }, { href: "/hoc-phi-cua-toi", label: "Học phí", icon: Wallet }, noti] }],
};

export const ROLE_LABEL: Record<Role, string> = { SUPERADMIN: "Quản trị nền tảng", ADMIN: "Quản trị", STAFF: "Nhân viên", TEACHER: "Giáo viên", STUDENT: "Học viên", PARENT: "Phụ huynh" };

const TITLES: Record<string, string> = {
  "lich-hoc": "Lịch học", "lop-hoc": "Lớp học", "hoc-vien": "Học viên", "giao-vien": "Giáo viên", "tro-giang": "Trợ giảng", "giao-vu": "Giáo vụ", "phan-cong": "Phân công lịch dạy", "phong-hoc": "Phòng học", "bang-diem": "Bộ điểm", "nhap-diem": "Nhập điểm", "co-so": "Cơ sở", platform: "Quản trị nền tảng", "tong-quan": "Tổng quan", "trung-tam": "Trung tâm", "don-hang": "Đơn hàng", "cau-hinh": "Gói & thanh toán", "goi-dich-vu": "Gói dịch vụ", "khoa-hoc": "Khoá học", "lich-cua-toi": "Lịch học", "diem-danh-cua-toi": "Điểm danh", "diem-cua-toi": "Bảng điểm", "hoc-phi-cua-toi": "Học phí",
  "tai-chinh": "Tài chính", "bao-cao": "Báo cáo", cong: "Chấm công", "nhan-vien": "Nhân viên & Tài khoản", "tai-lieu": "Tài liệu", "thong-bao": "Thông báo",
  "giao-dien": "Giao diện", "cai-dat": "Cài đặt", "doi-mat-khau": "Đổi mật khẩu", "diem-danh": "Điểm danh", diem: "Bảng điểm", "in-lich": "In lịch", "lop-cua-toi": "Lớp của tôi", "hoa-don": "Học phí", them: "Thêm mới",
};
export const titleOf = (seg: string) => TITLES[seg];
export { BookOpen, Landmark };
