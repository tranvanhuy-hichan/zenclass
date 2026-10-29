import { HeadSkeleton, CardsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div><HeadSkeleton /><CardsSkeleton n={8} cols="md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" /></div>
  );
}
