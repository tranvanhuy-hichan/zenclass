import { PeopleList } from "@/components/people-pages";

export default function Page({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; size?: string }> }) {
  return <PeopleList kind="coordinator" searchParams={searchParams} />;
}
