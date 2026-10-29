export { default } from "next-auth/middleware";

export const config = { matcher: ["/((?!login|api/auth|api/cron|api/webhook|_next|favicon.ico).*)"] };
