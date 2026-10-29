import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const { child } = await searchParams;
  redirect(child ? `/lich-hoc?child=${child}` : "/lich-hoc");
}
