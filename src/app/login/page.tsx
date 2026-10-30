import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function Login() {
  const s = await getSettings();
  return <LoginForm name={s.name} logo={s.theme.logo} />;
}
