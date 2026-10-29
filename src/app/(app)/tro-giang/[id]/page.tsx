import { PeopleDetail } from "@/components/people-pages";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; page?: string; size?: string }> }) {
  const { id } = await params;
  return <PeopleDetail kind="assistant" id={id} searchParams={searchParams} />;
}
