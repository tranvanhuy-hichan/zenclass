import { PortalSection } from "@/components/portal";

export default function Page({ searchParams }: { searchParams: Promise<{ child?: string; page?: string; size?: string }> }) {
  return <PortalSection searchParams={searchParams} title="Bảng điểm & Nhận xét" sections={["grades"]} path="/diem-cua-toi" />;
}
