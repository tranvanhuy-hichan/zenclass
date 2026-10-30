import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { genPassword, genStudentCode } from "@/lib/password";
import { createUser, freeUsername } from "@/server/accounts";
import { assertQuota } from "@/server/quota";

export type NewStudent = {
  fullName: string; phone?: string | null; dob?: Date | null; address?: string | null; parentName?: string | null; parentPhone?: string | null;
  gender?: string | null; email?: string | null; school?: string | null; gradeLevel?: string | null; source?: string | null; emergencyContact?: string | null; note?: string | null; avatarUrl?: string | null;
  parentEmail?: string | null; parentAddress?: string | null; parentJob?: string | null; parentRelation?: string | null;
};
export type Created = { code: string; password: string; fullName: string; parentAccount?: { username: string; password: string } };

export async function createStudentWithAccount(d: NewStudent): Promise<Created> {
  await assertQuota("students");
  let parentId: string | undefined;
  let parentAccount: Created["parentAccount"];
  if (d.parentPhone) {
    let p = await db.parent.findFirst({ where: { phone: d.parentPhone } });
    if (!p) {
      // Tên đăng nhập của phụ huynh là SĐT; nếu đã bị trung tâm khác dùng thì thêm hậu tố -2, -3...
      const username = await freeUsername(d.parentPhone);
      const { user, password } = await createUser("PARENT", username, d.parentName || "Phụ huynh");
      const userId = user.id;
      parentAccount = { username, password };
      p = await db.parent.create({ data: { phone: d.parentPhone, fullName: d.parentName || "Phụ huynh", userId, email: d.parentEmail, address: d.parentAddress, job: d.parentJob, relation: d.parentRelation } });
    }
    parentId = p.id;
  }
  const password = genPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  for (let i = 0; i < 8; i++) {
    const code = genStudentCode();
    try {
      await db.student.create({
        data: {
          code, fullName: d.fullName, phone: d.phone, dob: d.dob, address: d.address, gender: d.gender, email: d.email, school: d.school, gradeLevel: d.gradeLevel, source: d.source, emergencyContact: d.emergencyContact, note: d.note, avatarUrl: d.avatarUrl, ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
          user: { create: { username: code, fullName: d.fullName, role: "STUDENT", passwordHash, mustChangePwd: true } },
        },
      });
      return { code, password, fullName: d.fullName, parentAccount };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  throw new Error("Không tạo được mã học viên");
}
