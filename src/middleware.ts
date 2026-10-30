export { default } from "next-auth/middleware";

export const config = { matcher: ["/((?!login|api/auth|api/cron|api/webhook|api/files|_next|.*\\.(?:png|jpg|jpeg|svg|ico|webp|json|txt)$).*)"] };
