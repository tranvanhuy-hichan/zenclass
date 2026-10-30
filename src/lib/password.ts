import { randomInt } from "crypto";

// Bỏ các ký tự dễ nhầm: 0 O 1 l I
const CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function genPassword(len = 8) {
  return Array.from({ length: len }, () => CHARS[randomInt(CHARS.length)]).join("");
}

/** Mã / tên đăng nhập học viên: HV + 8 chữ số, vd HV48215937. */
export function genStudentCode() {
  return `HV${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;
}
