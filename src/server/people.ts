/* Cấu hình dùng chung cho Trợ giảng và Giáo vụ (quản lý riêng với Giáo viên). */
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

export type Kind = "assistant" | "coordinator";

export const KINDS = {
  assistant: { label: "Trợ giảng", base: "/tro-giang", role: "TEACHER" as Role, classKey: "assistantId" as const, desc: "Hỗ trợ giáo viên trong lớp: điểm danh, chấm bài, nhắc học viên." },
  coordinator: { label: "Giáo vụ", base: "/giao-vu", role: "STAFF" as Role, classKey: "coordinatorId" as const, desc: "Phụ trách vận hành lớp: xếp lịch, liên hệ phụ huynh, theo dõi chuyên cần và học phí." },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export const repo = (k: Kind): any => (k === "assistant" ? db.assistant : db.coordinator);
