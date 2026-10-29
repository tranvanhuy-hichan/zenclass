import { HeadSkeleton, StatsSkeleton, CardsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div><HeadSkeleton action={false} /><StatsSkeleton /><CardsSkeleton n={6} /></div>
  );
}
