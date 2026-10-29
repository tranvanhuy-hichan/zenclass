import { PortalSection } from "@/components/portal";

export default function Page({ searchParams }: { searchParams: Promise<{ child?: string; page?: string; size?: string }> }) {
  return <PortalSection searchParams={searchParams} title="Học phí" sections={["invoices"]} path="/hoc-phi-cua-toi" />;
}
