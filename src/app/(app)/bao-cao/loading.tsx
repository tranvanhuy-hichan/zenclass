import { HeadSkeleton, StatsSkeleton, CardsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div><HeadSkeleton action={false} /><StatsSkeleton n={3} /><CardsSkeleton n={2} cols="md:grid-cols-2" /></div>
  );
}
