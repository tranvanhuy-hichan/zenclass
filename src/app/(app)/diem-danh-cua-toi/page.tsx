import { PortalSection } from "@/components/portal";

export default function Page({ searchParams }: { searchParams: Promise<{ child?: string; classId?: string; page?: string; size?: string; view?: string; m?: string; n?: string }> }) {
  return <PortalSection searchParams={searchParams} title="Điểm danh" sections={["attendance"]} path="/diem-danh-cua-toi" paged />;
}
