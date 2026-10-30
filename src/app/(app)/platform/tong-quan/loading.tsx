import { HeadSkeleton, StatsSkeleton, CardsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <div><HeadSkeleton action={false} /><StatsSkeleton n={8} /><CardsSkeleton n={4} cols="xl:grid-cols-2" /></div>;
}
