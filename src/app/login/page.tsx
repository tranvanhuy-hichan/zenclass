import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Đăng nhập" };

// Chưa đăng nhập thì chưa biết trung tâm nào: dùng tên và logo của hệ thống.
export default function Login() {
  return <LoginForm name="Quản lý trung tâm" logo="/logo.png" />;
}
