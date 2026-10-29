import { randomInt } from "crypto";

// Bỏ các ký tự dễ nhầm: 0 O 1 l I
const CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function genPassword(len = 8) {
  return Array.from({ length: len }, () => CHARS[randomInt(CHARS.length)]).join("");
}

export function genStudentCode(fullName: string) {
  const initials = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .split(/\s+/)
    .filter(Boolean)
    .slice(-3)
    .map((w) => w[0].toUpperCase())
    .join("")
    .padEnd(3, "X");
  return `${initials}${randomInt(100, 1000)}`;
}
